/** Read-only: no email, SQL mutation, account creation or secret output. */
import dotenv from 'dotenv';
import { checkReleaseReadiness } from './release-readiness.mjs';
dotenv.config({path:'.env.local',quiet:true});
dotenv.config({quiet:true});
const checks=await checkReleaseReadiness(process.env,{
  remote:process.argv.includes('--remote'),allFeatures:process.argv.includes('--all-features'),
});
const blocked=checks.filter(c=>c.status==='blocked').length;
const manual=checks.filter(c=>c.status==='manual').length;
if(process.argv.includes('--json')) console.log(JSON.stringify({scope:'configured-environment',blocked,manual,checks},null,2));
else {
  for(const check of checks) console.log(`[${check.status.toUpperCase()}] ${check.id}: ${check.message}`);
  console.log(`\n${blocked} blocchi rilevati; ${manual} verifiche manuali. Nessuna modifica remota eseguita.`);
}
if(process.argv.includes('--strict')&&(blocked||manual))process.exitCode=1;
