// Set PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const companyInput = document.getElementById('company-name');
    const tickerInput = document.getElementById('company-ticker');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const investorBtns = document.querySelectorAll('.investor-btn');
    
    // Upload Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const pdfProgress = document.getElementById('pdf-progress');
    const pdfStatusText = document.getElementById('pdf-status-text');
    let uploadedReportText = '';
    
    // Status / Panels
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const reportContent = document.getElementById('report-content');
    
    // Output Elements
    const verdictCardAction = document.querySelector('#card-action .verdict-text');
    const scoreText = document.getElementById('overall-score');
    
    const beginnerSection = document.getElementById('beginner-section');
    const criteriaContainer = document.getElementById('criteria-container');
    const scoresContainer = document.getElementById('scores-container');
    const investorQuote = document.getElementById('investor-quote');
    const quoteAuthor = document.getElementById('quote-author');
    const deepAnalysis = document.getElementById('deep-analysis');
    
    let currentChart = null;
    let searchTimeout = null;

    // Autocomplete Handlers
    companyInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            autocompleteResults.classList.add('hidden');
            autocompleteResults.innerHTML = '';
            tickerInput.value = '';
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                if (data && data.length > 0) {
                    renderAutocomplete(data);
                } else {
                    autocompleteResults.classList.add('hidden');
                }
            } catch (err) {
                console.error("Autocomplete error:", err);
            }
        }, 300);
    });

    function renderAutocomplete(results) {
        autocompleteResults.innerHTML = '';
        results.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="ac-company">${item.company}</span>
                <span class="ac-ticker">${item.ticker} <span class="ac-exchange">${item.exchange || ''}</span></span>
            `;
            li.addEventListener('click', () => {
                companyInput.value = item.company;
                tickerInput.value = item.ticker;
                autocompleteResults.classList.add('hidden');
            });
            autocompleteResults.appendChild(li);
        });
        autocompleteResults.classList.remove('hidden');
    }

    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container')) {
            autocompleteResults.classList.add('hidden');
        }
    });

    // Event Listeners for Investor Buttons
    investorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            investorBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked
            btn.classList.add('active');
            
            const investor = btn.getAttribute('data-investor');
            const company = companyInput.value.trim() || 'Unknown Company';
            const ticker = tickerInput.value.trim() || 'UNKNOWN';
            
            analyzeStock(company, ticker, investor);
        });
    });

    // File Upload Handlers
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    async function handleFile(file) {
        if (file.type === 'application/pdf') {
            await extractTextFromPDF(file);
        } else if (file.type === 'text/plain') {
            uploadedReportText = await file.text();
            showUploadSuccess();
        } else {
            alert('Please upload a PDF or TXT file.');
        }
    }

    async function extractTextFromPDF(file) {
        try {
            uploadStatus.classList.remove('hidden');
            pdfStatusText.textContent = 'Reading PDF...';
            pdfStatusText.className = 'status-text pending';
            pdfProgress.style.width = '10%';

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let text = '';
            // Limit to 100 pages to prevent browser freezing
            const maxPages = Math.min(pdf.numPages, 100); 
            
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(' ') + '\n';
                
                // Update progress
                const progress = Math.round((i / maxPages) * 100);
                pdfProgress.style.width = `${progress}%`;
                pdfStatusText.textContent = `Extracting Text (Page ${i} of ${maxPages})...`;
            }

            uploadedReportText = text;
            showUploadSuccess();
        } catch (error) {
            console.error('PDF Extraction Error:', error);
            pdfStatusText.textContent = 'Failed to read PDF.';
            pdfStatusText.className = 'status-text verdict-avoid';
        }
    }

    function showUploadSuccess() {
        pdfStatusText.textContent = 'Document Ready! Select an investor below to analyze.';
        pdfStatusText.className = 'status-text verdict-buy';
        pdfProgress.style.width = '100%';
    }

    async function analyzeStock(company, ticker, investor) {
        // Prepare UI for loading
        showLoading();
        
        // Cache Key (Only use cache if no custom report is uploaded)
        const cacheKey = `sc26_${ticker}_${investor.replace(/\s+/g, '')}`;
        
        if (!uploadedReportText) {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    const data = JSON.parse(cachedData);
                    // Invalidate old cache that didn't have the metrics object
                    if (data.metrics) {
                        console.log("Using cached data for", cacheKey);
                        renderReport(data, investor);
                        return;
                    } else {
                        console.log("Cached data is missing metrics, fetching new...");
                        localStorage.removeItem(cacheKey);
                    }
                } catch (e) {
                    console.warn("Invalid cache data, fetching new.");
                }
            }
        }

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    company, 
                    ticker, 
                    investor,
                    reportText: uploadedReportText || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to analyze stock');
            }

            // Save to cache only if no custom report was used
            if (!uploadedReportText) {
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
            
            renderReport(data, investor);

        } catch (error) {
            console.error(error);
            showError(error.message);
        }
    }

    function renderReport(data, investorName) {
        // Hide loading, show report
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        reportContent.classList.remove('hidden');

        // 1. Update Verdict Cards
        updateVerdictCard(data.verdict, data.overallScore);
        
        // Update other static cards slightly to simulate completion
        document.querySelector('#card-business .status-text').textContent = "Analyzed";
        document.querySelector('#card-business .status-text').classList.remove('pending');
        document.querySelector('#card-trend .status-text').textContent = "Determined";
        document.querySelector('#card-trend .status-text').classList.remove('pending');
        document.querySelector('#card-revenue .status-text').textContent = "Evaluated";
        document.querySelector('#card-revenue .status-text').classList.remove('pending');

        // 2. Build 5-point beginner list from analysis text (simulate breakdown)
        // Since the prompt asks for a 3-4 sentence analysis, we'll split it roughly into points.
        const sentences = data.analysis.split('.').filter(s => s.trim().length > 5);
        beginnerSection.innerHTML = sentences.map(s => `<li>${s.trim()}.</li>`).join('');

        // 3. Render Criteria
        if (data.criteria && Array.isArray(data.criteria)) {
            criteriaContainer.innerHTML = data.criteria.map(c => {
                const statusClass = `badge-${c.status.toLowerCase()}`;
                return `
                <div class="criteria-item">
                    <div class="criteria-header">
                        <span>${c.label}</span>
                        <span class="badge ${statusClass}">${c.status}</span>
                    </div>
                    <div class="criteria-desc">${c.description}</div>
                </div>
                `;
            }).join('');
        }

        // 4. Render Scores
        if (data.scores && Array.isArray(data.scores)) {
            scoresContainer.innerHTML = data.scores.map(s => {
                const percentage = (s.value / s.max) * 100;
                return `
                <div class="score-row">
                    <div class="score-label">
                        <span>${s.label}</span>
                        <span>${s.value}/${s.max}</span>
                    </div>
                    <div class="score-bar-bg">
                        <div class="score-bar-fill" style="width: 0%" data-target="${percentage}%"></div>
                    </div>
                </div>
                `;
            }).join('');

            // Animate score bars
            setTimeout(() => {
                document.querySelectorAll('.score-bar-fill').forEach(bar => {
                    bar.style.width = bar.getAttribute('data-target');
                });
            }, 100);
        }

        // 5. Render Quote
        investorQuote.textContent = `"${data.quote}"`;
        quoteAuthor.textContent = investorName;

        // 6. Deep Analysis
        deepAnalysis.textContent = data.analysis;

        // 7. Render Chart
        renderChart(data.metrics);
    }

    function updateVerdictCard(verdict, score) {
        verdictCardAction.textContent = verdict;
        verdictCardAction.className = 'status-text verdict-text'; // Reset
        
        const v = verdict.toLowerCase();
        if (v.includes('buy')) verdictCardAction.classList.add('verdict-buy');
        else if (v.includes('watch')) verdictCardAction.classList.add('verdict-watch');
        else if (v.includes('sell') || v.includes('avoid')) verdictCardAction.classList.add('verdict-sell');
        else verdictCardAction.classList.add('verdict-hold');

        scoreText.textContent = `Overall Score: ${score}/100`;
    }

    function showLoading() {
        loadingState.classList.remove('hidden');
        errorState.classList.add('hidden');
        reportContent.classList.add('hidden');
        
        // Reset static cards
        document.querySelectorAll('.card:not(#card-action) .status-text').forEach(el => {
            el.textContent = "Analyzing...";
            el.classList.add('pending');
        });
    }

    function showError(msg) {
        loadingState.classList.add('hidden');
        reportContent.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.textContent = msg;
    }

    function renderChart(metricsData) {
        const ctx = document.getElementById('financialChart').getContext('2d');
        
        if (currentChart) {
            currentChart.destroy();
        }

        // Default metrics if API didn't return them correctly
        const metrics = metricsData || { pe: 0, pb: 0, roc: 0, roce: 0 };
        
        const labels = ['P/E Ratio', 'P/B Ratio', 'ROC (%)', 'ROCE (%)'];
        const dataPoints = [metrics.pe, metrics.pb, metrics.roc, metrics.roce];

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Financial Metrics',
                    data: dataPoints,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.6)', // Blue for PE
                        'rgba(16, 185, 129, 0.6)', // Green for PB
                        'rgba(245, 158, 11, 0.6)', // Yellow for ROC
                        'rgba(99, 102, 241, 0.6)'  // Indigo for ROCE
                    ],
                    borderColor: [
                        '#3B82F6',
                        '#10B981',
                        '#F59E0B',
                        '#6366F1'
                    ],
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.dataIndex > 1) {
                                    label += context.parsed.y + '%';
                                } else {
                                    label += context.parsed.y + 'x';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94A3B8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94A3B8', font: { size: 13, family: "'Outfit', sans-serif" } }
                    }
                }
            }
        });
    }
});
