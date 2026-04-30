const analyze = require('./api/analyze.js');

async function test() {
    const req = {
        method: 'POST',
        body: {
            company: 'Tata Consultancy Services',
            ticker: 'TCS',
            investor: 'Warren Buffett'
        }
    };
    
    const res = {
        setHeader: () => {},
        status: (code) => {
            return {
                json: (data) => {
                    console.log(`Status: ${code}`);
                    console.log(JSON.stringify(data, null, 2));
                },
                end: () => {}
            };
        }
    };

    await analyze(req, res);
}

test();
