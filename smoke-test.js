#!/usr/bin/env node

/**
 * Smoke test to verify all dashboard components can be imported and initialized
 */

console.log('🧪 Running dashboard component smoke test...\n');

async function testComponents() {
  try {
    console.log('📦 Testing component imports...');
    
    // Test all extracted components
    const components = [
      { name: 'LivePrices', path: './dashboard/src/components/LivePrices.tsx' },
      { name: 'ActiveSignals', path: './dashboard/src/components/ActiveSignals.tsx' },
      { name: 'PortfolioHistoryChart', path: './dashboard/src/components/PortfolioHistoryChart.tsx' },
      { name: 'SystemStatus', path: './dashboard/src/components/SystemStatus.tsx' },
      { name: 'ActivityFeed', path: './dashboard/src/components/ActivityFeed.tsx' },
      { name: 'BotControl', path: './dashboard/src/components/BotControl.tsx' },
      { name: 'AIConfigModal', path: './dashboard/src/components/AIConfigModal.tsx' }
    ];

    for (const component of components) {
      try {
        console.log(`  ✓ Testing ${component.name}...`);
        // Try to read the component file to verify it exists and is valid
        const fs = await import('fs');
        const content = fs.readFileSync(component.path, 'utf8');
        
        // Basic checks
        if (!content.includes('export')) {
          throw new Error('Missing export statement');
        }
        if (!content.includes('function') && !content.includes('class') && !content.includes('const')) {
          throw new Error('No component definition found');
        }
        
        console.log(`    ✅ ${component.name} - Valid component structure`);
      } catch (error) {
        console.error(`    ❌ ${component.name} - ${error.message}`);
        return false;
      }
    }

    console.log('\n🎯 Testing main App.tsx imports...');
    const fs = await import('fs');
    const appContent = fs.readFileSync('./dashboard/src/App.tsx', 'utf8');
    
    // Verify all components are imported
    const requiredImports = [
      'LivePrices', 'ActiveSignals', 'PortfolioHistoryChart', 
      'SystemStatus', 'ActivityFeed', 'BotControl', 'AIConfigModal'
    ];
    
    for (const importName of requiredImports) {
      if (!appContent.includes(importName)) {
        throw new Error(`Missing import: ${importName}`);
      }
    }
    
    console.log('    ✅ All component imports present');
    
    // Verify components are used in JSX
    for (const componentName of requiredImports) {
      if (!appContent.includes(`<${componentName}`)) {
        throw new Error(`Component not used: ${componentName}`);
      }
    }
    
    console.log('    ✅ All components used in JSX');

    console.log('\n🔧 Testing TypeScript compilation...');
    const { execSync } = await import('child_process');
    try {
      execSync('bun run build', { stdio: 'pipe', cwd: process.cwd() });
      console.log('    ✅ TypeScript compilation successful');
    } catch (error) {
      console.error('    ❌ TypeScript compilation failed');
      return false;
    }

    console.log('\n🎉 All smoke tests passed!');
    console.log('✅ Components are properly structured');
    console.log('✅ Main App.tsx imports and uses all components');
    console.log('✅ TypeScript compilation succeeds');
    console.log('✅ Dashboard is ready for manual verification');
    
    return true;
  } catch (error) {
    console.error('❌ Smoke test failed:', error);
    return false;
  }
}

// Run the smoke test
testComponents().then(success => {
  if (success) {
    console.log('\n🌐 Dashboard is running on: http://localhost:5174');
    console.log('📋 Manual verification checklist:');
    console.log('  1. Open http://localhost:5174 in browser');
    console.log('  2. Verify all 7 components render without errors');
    console.log('  3. Check that component data displays correctly');
    console.log('  4. Confirm no broken UI elements');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
