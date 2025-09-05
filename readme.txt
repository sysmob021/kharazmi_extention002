npm install -g javascript-obfuscator
javascript-obfuscator background.js --output background.obf.js --compact true --control-flow-flattening true
javascript-obfuscator src/ --output dist/ --compact true --control-flow-flattening true
