const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const REPO = 'zagzy8776/realssa';
const IDS = [5529165043,5527386038,5521780354,5519361118,5519025525,5518964071,5518911476,5518786579,5515597784,5515527237,5515445835,5515410868,5515351030,5515268244,5515213043,5514312664,5514176694,5514141853,5514028857,5513922124,5513519010,5513469217,5513309375,5513248881,5512232414,5512120042,5512036882,5511824303,5511371088,5511208821,5511059501,5510632468,5506702078,5506681527,5506512294,5506505413,5506279306,5506080448,5505870340,5505811113,5505776114,5505720358,5505653702,5505586877,5505538914,5505402039,5505381086,5505320250,5505299894,5505271107];

const headers = {
  'Authorization': `token ${TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json'
};

let deleted = 0, failed = 0;

for (const id of IDS) {
  // Step 1: mark as inactive
  await fetch(`https://api.github.com/repos/${REPO}/deployments/${id}/statuses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ state: 'inactive' })
  });

  // Step 2: delete
  const res = await fetch(`https://api.github.com/repos/${REPO}/deployments/${id}`, {
    method: 'DELETE',
    headers
  });

  if (res.status === 204) {
    deleted++;
  } else {
    const data = await res.json();
    console.log(`Failed ${id}: ${res.status} — ${data.message}`);
    failed++;
  }
}

console.log(`\nDone — deleted: ${deleted}, failed: ${failed}`);
