export async function reportSecurityFaults({rpc,send}) {
  const claim=await rpc('security_monitor_claim',{});
  if(!claim)return {sent:false};
  try {
    const lines=Object.entries(claim.faults).map(([kind,count])=>`${kind}: ${count}`).join('\n');
    await send({to:'pekka@data.co.za',subject:`My World Heritage - ${claim.recovery?'operational recovery':'operational faults'}`,
      text:`Checked at: ${claim.checked_at}\n\n${claim.recovery?'Previously reported conditions are no longer detected.':lines}\n\nReview Security health, Action history and Notifications in owner administration. A recovery observation does not replace investigation or close an Issue.\n\nhttps://pekka-28.github.io/unesco/admin/\n\nCoverage: notification delivery, uncertain owner commands and latest failed active scheduled jobs. This is not a complete platform security audit. Repeated faults are reported at most hourly.`},claim.lease);
    if(!await rpc('security_monitor_finish',{p_lease:claim.lease,p_faults:claim.faults,p_sent:true}))
      throw new Error('Monitor completion not recorded');
    return {sent:true};
  } catch {
    await rpc('security_monitor_finish',{p_lease:claim.lease,p_faults:claim.faults,p_sent:false});
    throw new Error('Security fault reporting failed; inspect Security health');
  }
}
