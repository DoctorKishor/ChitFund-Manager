const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vliuvsogkbarbwbrhsaf.supabase.co';
const supabaseKey = 'sb_secret_6Sdp2iWHpf80sU2o3cpgsQ_b_4WfIQl';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetTreasury() {
  const wallets = ['cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank'];
  for (const w of wallets) {
    const { data, error } = await supabase
      .from('global_treasury')
      .upsert({ wallet_type: w, current_balance: 0 }, { onConflict: 'wallet_type' });
    
    if (error) console.error(`Error resetting ${w}:`, error.message);
    else console.log(`Reset ${w} to 0`);
  }
  console.log('Treasury reset complete.');
}

resetTreasury();
