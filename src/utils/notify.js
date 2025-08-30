export async function notifyApproval(user, profile) {
  // Placeholder: integrate email/SMS provider here
  const status = profile?.approvalStatus;
  const note = profile?.approvalNote;
  console.log(`[notify] Would notify ${user.email} — status: ${status}${status==='rejected' && note ? ' — note: '+note : ''}`);
}