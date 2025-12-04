#!/usr/bin/env node

/**
 * Test script to verify circular dependency fix between realisticPaperTrader and statePersistence
 */

console.log('🧪 Testing circular dependency fix...\n');

async function testCircularDependencies() {
  try {
    console.log('📦 Importing realisticPaperTrader...');
    const { realisticPaperTrader } = await import('./dist/core/realisticPaperTrader.js');
    console.log('✅ realisticPaperTrader imported successfully');

    console.log('📦 Importing statePersistence...');
    const { statePersistence } = await import('./dist/core/statePersistence.js');
    console.log('✅ statePersistence imported successfully');

    console.log('🔄 Testing realisticPaperTrader functionality...');
    const portfolioState = realisticPaperTrader.getPortfolioState();
    console.log(`✅ Portfolio state retrieved: $${portfolioState.totalValueUsdt} USDT`);

    console.log('💾 Testing statePersistence functionality...');
    const stateInfo = statePersistence.getStateInfo();
    console.log(`✅ State info retrieved: hasState=${stateInfo.hasState}, backupExists=${stateInfo.backupExists}`);

    console.log('\n🎉 All circular dependency tests passed!');
    console.log('✅ Modules can be imported without circular dependency errors');
    console.log('✅ Basic functionality works correctly');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
testCircularDependencies().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
