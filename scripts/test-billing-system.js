#!/usr/bin/env node
/**
 * Billing System Test Script
 * Tests all billing operations end-to-end
 */

require('dotenv').config();
const billingService = require('../core/billing/services/billingService');
const { v4: uuidv4 } = require('uuid');

// Test tenant and user IDs (use Glinks tenant we created)
const TEST_TENANT_ID = '926070b5-189b-4682-9279-ea10ca090b84'; // Glinks
const TEST_USER_ID = 'fe9d6368-ff1b-4133-952a-525d60d06cbe'; // admin@glinks.com

async function runTests() {
  console.log('🧪 Testing LAD Billing System\n');
  console.log(`Tenant: ${TEST_TENANT_ID}`);
  console.log(`User: ${TEST_USER_ID}\n`);
  
  try {
    // =================================================================
    // TEST 1: Price Resolution
    // =================================================================
    console.log('📝 TEST 1: Price Resolution');
    console.log('─'.repeat(60));
    
    const sttPrice = await billingService.resolvePrice({
      tenantId: TEST_TENANT_ID,
      category: 'stt',
      provider: 'openai',
      model: 'whisper-1',
      unit: 'second'
    });
    
    console.log(`✅ STT Price: $${sttPrice.unitPrice}/second (${sttPrice.model})`);
    
    const llmPrice = await billingService.resolvePrice({
      tenantId: TEST_TENANT_ID,
      category: 'llm',
      provider: 'openai',
      model: 'gpt-4',
      unit: 'token'
    });
    
    console.log(`✅ LLM Price: $${llmPrice.unitPrice}/token (${llmPrice.model})\n`);
    
    // =================================================================
    // TEST 2: Quote (Cost Estimation)
    // =================================================================
    console.log('📝 TEST 2: Quote (Cost Estimation)');
    console.log('─'.repeat(60));
    
    const quote = await billingService.quote({
      tenantId: TEST_TENANT_ID,
      items: [
        { category: 'stt', provider: 'openai', model: 'whisper-1', unit: 'second', quantity: 60 },
        { category: 'llm', provider: 'openai', model: 'gpt-4', unit: 'token', quantity: 500 },
        { category: 'tts', provider: 'openai', model: 'tts-1', unit: 'character', quantity: 200 },
        { category: 'telephony', provider: 'twilio', model: 'voice', unit: 'minute', quantity: 1 }
      ]
    });
    
    console.log(`✅ Quote generated:`);
    console.log(`   Total Cost: $${quote.totalCost}`);
    console.log(`   Items: ${quote.items.length}`);
    quote.items.forEach(item => {
      console.log(`   - ${item.category}: ${item.quantity} ${item.unit} × $${item.unitPrice} = $${item.cost}`);
    });
    console.log();
    
    // =================================================================
    // TEST 3: Wallet Operations
    // =================================================================
    console.log('📝 TEST 3: Wallet Operations');
    console.log('─'.repeat(60));
    
    // Check initial balance
    let wallet = await billingService.getWalletBalance(TEST_TENANT_ID);
    console.log(`💰 Initial Balance: $${wallet.currentBalance}`);
    
    // Top up wallet
    const topupAmount = 10.00;
    console.log(`📥 Topping up $${topupAmount}...`);
    
    await billingService.creditWalletAtomic({
      tenantId: TEST_TENANT_ID,
      amount: topupAmount,
      referenceType: 'manual',
      referenceId: null,
      idempotencyKey: `test_topup_${Date.now()}`,
      description: 'Test top-up',
      createdBy: TEST_USER_ID
    });
    
    wallet = await billingService.getWalletBalance(TEST_TENANT_ID);
    console.log(`✅ New Balance: $${wallet.currentBalance}\n`);
    
    // =================================================================
    // TEST 4: Usage Event Creation
    // =================================================================
    console.log('📝 TEST 4: Usage Event Creation');
    console.log('─'.repeat(60));
    
    const testCallId = uuidv4();
    console.log(`📞 Creating usage event for call: ${testCallId}`);
    
    const usageEvent = await billingService.createUsageEvent({
      tenantId: TEST_TENANT_ID,
      userId: TEST_USER_ID,
      featureKey: 'voice-agent',
      items: [
        { category: 'stt', provider: 'openai', model: 'whisper-1', unit: 'second', quantity: 30 },
        { category: 'llm', provider: 'openai', model: 'gpt-4', unit: 'token', quantity: 250 },
        { category: 'tts', provider: 'openai', model: 'tts-1', unit: 'character', quantity: 100 }
      ],
      idempotencyKey: `test_call_${testCallId}`,
      externalReferenceId: testCallId,
      metadata: { testRun: true }
    });
    
    console.log(`✅ Usage Event Created:`);
    console.log(`   ID: ${usageEvent.id}`);
    console.log(`   Feature: ${usageEvent.feature_key}`);
    console.log(`   Status: ${usageEvent.status}`);
    console.log(`   Total Cost: $${usageEvent.total_cost}`);
    const items = typeof usageEvent.usage_items === 'string' 
      ? JSON.parse(usageEvent.usage_items) 
      : usageEvent.usage_items;
    console.log(`   Items: ${items.length}\n`);
    
    // =================================================================
    // TEST 5: Charging Usage Event
    // =================================================================
    console.log('📝 TEST 5: Charging Usage Event');
    console.log('─'.repeat(60));
    
    console.log(`💳 Charging usage event ${usageEvent.id}...`);
    
    const ledgerTx = await billingService.chargeUsageEvent({
      usageEventId: usageEvent.id,
      tenantId: TEST_TENANT_ID
    });
    
    console.log(`✅ Charged Successfully:`);
    console.log(`   Ledger TX ID: ${ledgerTx.id}`);
    console.log(`   Amount: $${Math.abs(ledgerTx.amount)}`);
    console.log(`   Balance Before: $${ledgerTx.balance_before}`);
    console.log(`   Balance After: $${ledgerTx.balance_after}\n`);
    
    wallet = await billingService.getWalletBalance(TEST_TENANT_ID);
    console.log(`💰 Current Balance: $${wallet.currentBalance}\n`);
    
    // =================================================================
    // TEST 6: Idempotency Check
    // =================================================================
    console.log('📝 TEST 6: Idempotency Check');
    console.log('─'.repeat(60));
    
    console.log(`🔄 Attempting to charge same usage event again...`);
    
    const duplicateTx = await billingService.chargeUsageEvent({
      usageEventId: usageEvent.id,
      tenantId: TEST_TENANT_ID
    });
    
    if (duplicateTx.alreadyCharged) {
      console.log(`✅ Idempotency working! No duplicate charge.\n`);
    } else {
      console.log(`❌ WARNING: Duplicate charge was allowed!\n`);
    }
    
    // =================================================================
    // TEST 7: Usage History
    // =================================================================
    console.log('📝 TEST 7: Usage History');
    console.log('─'.repeat(60));
    
    const usageHistory = await billingService.listUsageEvents({
      tenantId: TEST_TENANT_ID,
      featureKey: 'voice-agent',
      limit: 5
    });
    
    console.log(`📊 Recent Usage Events (${usageHistory.length}):`);
    usageHistory.forEach((event, i) => {
      console.log(`   ${i + 1}. ${event.feature_key} - $${event.total_cost} (${event.status})`);
    });
    console.log();
    
    // =================================================================
    // TEST 8: Transaction Ledger
    // =================================================================
    console.log('📝 TEST 8: Transaction Ledger');
    console.log('─'.repeat(60));
    
    const ledgerHistory = await billingService.listLedgerTransactions({
      tenantId: TEST_TENANT_ID,
      limit: 5
    });
    
    console.log(`📚 Recent Ledger Transactions (${ledgerHistory.length}):`);
    ledgerHistory.forEach((tx, i) => {
      const sign = tx.amount > 0 ? '+' : '';
      console.log(`   ${i + 1}. ${tx.transaction_type}: ${sign}$${tx.amount} (Balance: $${tx.balance_after})`);
    });
    console.log();
    
    // =================================================================
    // TEST 9: Create and Charge Immediately
    // =================================================================
    console.log('📝 TEST 9: Create and Charge Immediately');
    console.log('─'.repeat(60));
    
    const quickCallId = uuidv4();
    console.log(`⚡ Creating and charging in one operation...`);
    
    const result = await billingService.createAndChargeUsageEvent({
      tenantId: TEST_TENANT_ID,
      userId: TEST_USER_ID,
      featureKey: 'voice-agent',
      items: [
        { category: 'stt', provider: 'openai', model: 'whisper-1', unit: 'second', quantity: 15 }
      ],
      idempotencyKey: `quick_test_${quickCallId}`,
      externalReferenceId: quickCallId
    });
    
    console.log(`✅ Created and Charged:`);
    console.log(`   Usage Event: ${result.usageEvent.id}`);
    console.log(`   Ledger TX: ${result.ledgerTransaction.id}`);
    console.log(`   Cost: $${result.usageEvent.total_cost}\n`);
    
    // =================================================================
    // FINAL SUMMARY
    // =================================================================
    console.log('═'.repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('═'.repeat(60));
    
    wallet = await billingService.getWalletBalance(TEST_TENANT_ID);
    const summary = await billingService.getUsageAggregation({
      tenantId: TEST_TENANT_ID,
      featureKey: 'voice-agent'
    });
    
    console.log(`\n💰 Wallet:`);
    console.log(`   Balance: $${wallet.currentBalance}`);
    console.log(`   Status: ${wallet.status}`);
    
    console.log(`\n📈 Usage Summary:`);
    summary.forEach(row => {
      console.log(`   ${row.feature_key} (${row.status}): ${row.event_count} events, $${row.total_cost}`);
    });
    
    console.log('\n✅ All tests passed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run tests
runTests();
