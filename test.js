// test-journey-steps.js
const JOURNEY_STEPS = require('./data/journeySteps');

console.log('📊 Total steps:', JOURNEY_STEPS.length);
console.log('📊 Should be: 23');
console.log('\n📋 All steps:');
JOURNEY_STEPS.forEach(step => {
  console.log(`Step ${step.step}: ${step.title} (${step.phase})`);
  if (step.subSteps) {
    console.log(`  └─ ${step.subSteps.length} substeps`);
  }
});