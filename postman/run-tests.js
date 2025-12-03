// BeamShare Drive API automated runner
// Requires: npm install -g newman

const { exec } = require('child_process');
const path = require('path');

const collectionPath = path.join(__dirname, 'BeamShare-API-Collection.json');
const environmentPath = path.join(__dirname, 'BeamShare-Environment.json');
const resultsPath = path.join(__dirname, 'test-results.json');

const command = `newman run "${collectionPath}" -e "${environmentPath}" --reporters cli,json --reporter-json-export "${resultsPath}"`;

console.log('🚀 Running BeamShare API Tests...\n');

const handleExecution = (error, stdout, stderr) => {
  if (stdout) {
    process.stdout.write(stdout);
  }

  if (stderr) {
    process.stderr.write(stderr);
  }

  if (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(error.code || 1);
  }

  console.log('\n✅ Tests completed successfully!');
};

exec(command, handleExecution);
