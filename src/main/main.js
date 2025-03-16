const { R1Integration } = require('../zak/r1');

app.whenReady().then(async () => {
    // Initialize R1
    const r1Integration = new R1Integration();
    const r1Initialized = await r1Integration.initialize();
    if (!r1Initialized) {
        console.warn('R1 initialization failed. Some AI features may be limited.');
    } else {
        console.log('R1 initialized successfully');
    }
}); 