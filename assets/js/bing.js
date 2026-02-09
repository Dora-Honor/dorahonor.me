const https = require('https')
const fs = require('fs')

const options = {
  hostname: 'www.bing.com',
  port: 443,
  path: '/HPImageArchive.aspx?format=js&idx=0&n=8',
  method: 'GET'
}

const req = https.request(options, bing_res => {
  const chunks = [];
  bing_res.on('data', (chunk) => {
    chunks.push(chunk);
  });
  bing_res.on('end', () => {
    const bing_data = Buffer.concat(chunks).toString();
    const data = JSON.parse(bing_data);
    const img_url = data.images.map(img => img.url);
    const jsStr = "window.BING_IMAGES = " + JSON.stringify(img_url) + ";";
    fs.mkdirSync('./assets/json', { recursive: true });
    fs.writeFile('./assets/json/images.js', jsStr, (err) => {
      if (err) {
        throw err;
      }
      console.log("JSON data is saved: " + jsStr);
    });
  });
})

req.on('error', error => {
  console.error(error)
})

req.end()
