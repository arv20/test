const fetch = require('node-fetch');

async function testAPI() {
    try {
        const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer d9b4794553a04e4ba9922dc262297ef9"
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "user",
                    content: "Hello, how are you?"
                }]
            })
        });

        const text = await response.text();
        console.log("Response status:", response.status);
        console.log("Response text:", text);
    } catch (error) {
        console.error("Error:", error);
    }
}

testAPI();