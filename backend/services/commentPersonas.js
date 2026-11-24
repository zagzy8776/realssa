/**
 * RealSSA community seed personas
 * -----------------------------
 * ~100 realistic display names used by the discussion seeder so article
 * threads are not empty when readers arrive. Weighted toward Australian
 * readers (strong RealSSA audience) plus Nigerian / African / global mix.
 *
 * These are BOT personas (is_bot = true in DB). They exist to spark discussion,
 * not to impersonate real private individuals.
 */

const PERSONAS = [
  // —— Australia (primary audience weight) ——
  { name: 'Jess from Brisbane', region: 'AU', style: 'casual' },
  { name: 'Mateo K.', region: 'AU', style: 'sports' },
  { name: 'Ava Thompson', region: 'AU', style: 'curious' },
  { name: 'Ryan O\'Neill', region: 'AU', style: 'direct' },
  { name: 'Chloe Nguyen', region: 'AU', style: 'thoughtful' },
  { name: 'Liam Patterson', region: 'AU', style: 'sports' },
  { name: 'Sophie Clarke', region: 'AU', style: 'casual' },
  { name: 'Noah Mitchell', region: 'AU', style: 'skeptical' },
  { name: 'Mia Hassan', region: 'AU', style: 'curious' },
  { name: 'Jack Reynolds', region: 'AU', style: 'direct' },
  { name: 'Emma Walsh', region: 'AU', style: 'thoughtful' },
  { name: 'Ethan Brooks', region: 'AU', style: 'sports' },
  { name: 'Olivia Grant', region: 'AU', style: 'casual' },
  { name: 'Lucas Ahmed', region: 'AU', style: 'curious' },
  { name: 'Isabella King', region: 'AU', style: 'thoughtful' },
  { name: 'Harry Bennett', region: 'AU', style: 'direct' },
  { name: 'Zoe Campbell', region: 'AU', style: 'casual' },
  { name: 'Charlie Dunn', region: 'AU', style: 'sports' },
  { name: 'Amelia Singh', region: 'AU', style: 'curious' },
  { name: 'Thomas Reid', region: 'AU', style: 'skeptical' },
  { name: 'Grace Fuller', region: 'AU', style: 'thoughtful' },
  { name: 'Oscar Liu', region: 'AU', style: 'direct' },
  { name: 'Lily Morgan', region: 'AU', style: 'casual' },
  { name: 'Nathan Price', region: 'AU', style: 'sports' },
  { name: 'Ruby Foster', region: 'AU', style: 'curious' },
  { name: 'Leo Sanders', region: 'AU', style: 'direct' },
  { name: 'Hannah Ross', region: 'AU', style: 'thoughtful' },
  { name: 'Max Turner', region: 'AU', style: 'casual' },
  { name: 'Ella Hughes', region: 'AU', style: 'curious' },
  { name: 'Archie Bell', region: 'AU', style: 'sports' },
  { name: 'Sienna Ward', region: 'AU', style: 'casual' },
  { name: 'Finn Cooper', region: 'AU', style: 'skeptical' },
  { name: 'Poppy James', region: 'AU', style: 'thoughtful' },
  { name: 'George Bailey', region: 'AU', style: 'direct' },
  { name: 'Ivy Richardson', region: 'AU', style: 'curious' },
  { name: 'Hudson Cole', region: 'AU', style: 'sports' },
  { name: 'Aria Bennett', region: 'AU', style: 'casual' },
  { name: 'Kai Nakamura', region: 'AU', style: 'curious' },
  { name: 'Bonnie Stewart', region: 'AU', style: 'thoughtful' },
  { name: 'Xavier Lane', region: 'AU', style: 'direct' },

  // —— Nigeria / West Africa ——
  { name: 'Tunde A.', region: 'NG', style: 'direct' },
  { name: 'Chioma Okeke', region: 'NG', style: 'thoughtful' },
  { name: 'Ibrahim Musa', region: 'NG', style: 'skeptical' },
  { name: 'Funke Adeyemi', region: 'NG', style: 'casual' },
  { name: 'Emeka Nwosu', region: 'NG', style: 'direct' },
  { name: 'Aisha Bello', region: 'NG', style: 'curious' },
  { name: 'Kelechi Obi', region: 'NG', style: 'sports' },
  { name: 'Ngozi Eze', region: 'NG', style: 'thoughtful' },
  { name: 'Sola Bakare', region: 'NG', style: 'casual' },
  { name: 'Yusuf Lawal', region: 'NG', style: 'skeptical' },
  { name: 'Amaka Uche', region: 'NG', style: 'curious' },
  { name: 'Femi Dada', region: 'NG', style: 'sports' },
  { name: 'Blessing Okon', region: 'NG', style: 'casual' },
  { name: 'Chinedu Okoro', region: 'NG', style: 'direct' },
  { name: 'Zainab Yusuf', region: 'NG', style: 'thoughtful' },

  // —— Ghana / East & Southern Africa ——
  { name: 'Kwame Mensah', region: 'GH', style: 'direct' },
  { name: 'Ama Serwaa', region: 'GH', style: 'casual' },
  { name: 'Kojo Boateng', region: 'GH', style: 'sports' },
  { name: 'Abena Owusu', region: 'GH', style: 'curious' },
  { name: 'Wanjiku N.', region: 'KE', style: 'thoughtful' },
  { name: 'Brian Otieno', region: 'KE', style: 'direct' },
  { name: 'Amina Hassan', region: 'KE', style: 'curious' },
  { name: 'Thabo Molefe', region: 'ZA', style: 'skeptical' },
  { name: 'Lerato Dlamini', region: 'ZA', style: 'casual' },
  { name: 'Sipho Nkosi', region: 'ZA', style: 'sports' },

  // —— Global / diaspora ——
  { name: 'James Carter', region: 'UK', style: 'direct' },
  { name: 'Priya Sharma', region: 'IN', style: 'curious' },
  { name: 'Daniel Okonkwo', region: 'US', style: 'thoughtful' },
  { name: 'Maria Santos', region: 'BR', style: 'casual' },
  { name: 'Chen Wei', region: 'CN', style: 'skeptical' },
  { name: 'Sarah Mitchell', region: 'CA', style: 'curious' },
  { name: 'Omar Farouk', region: 'EG', style: 'direct' },
  { name: 'Anita Desai', region: 'IN', style: 'thoughtful' },
  { name: 'Chris Walker', region: 'US', style: 'sports' },
  { name: 'Fatima Al-Rashid', region: 'AE', style: 'curious' },
  { name: 'Paul Okello', region: 'UG', style: 'direct' },
  { name: 'Nadia Petrov', region: 'EU', style: 'thoughtful' },
  { name: 'Marcus Greene', region: 'US', style: 'skeptical' },
  { name: 'Yara Haddad', region: 'LB', style: 'curious' },
  { name: 'Ben Taylor', region: 'UK', style: 'casual' },
  { name: 'Ruth Mbeki', region: 'ZA', style: 'thoughtful' },
  { name: 'Alex Rivera', region: 'US', style: 'sports' },
  { name: 'Helen Okada', region: 'JP', style: 'curious' },
  { name: 'Samir Khan', region: 'PK', style: 'direct' },
  { name: 'Claire Dubois', region: 'FR', style: 'thoughtful' },
  { name: 'Michael Brown', region: 'US', style: 'skeptical' },
  { name: 'Adaobi Nnamdi', region: 'NG', style: 'casual' },
  { name: 'Tom Harrington', region: 'AU', style: 'direct' },
  { name: 'Nia Mensah', region: 'GH', style: 'curious' },
  { name: 'Victor Alves', region: 'BR', style: 'sports' },
  { name: 'Janet Okello', region: 'KE', style: 'thoughtful' },
  { name: 'Patrick O\'Brien', region: 'IE', style: 'casual' },
  { name: 'Sofia Martins', region: 'PT', style: 'curious' },
  { name: 'Derek Mensah', region: 'GH', style: 'direct' },
  { name: 'Laura Kim', region: 'KR', style: 'thoughtful' },
  { name: 'Ahmed Bakr', region: 'EG', style: 'skeptical' },
  { name: 'Grace Mwangi', region: 'KE', style: 'casual' },
  { name: 'Peter Johansson', region: 'SE', style: 'curious' },
  { name: 'Ifeoma Chukwu', region: 'NG', style: 'thoughtful' },
];

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic but varied persona picks for an article */
function pickPersonas(articleId, count = 3) {
  const n = Math.max(1, Math.min(count, PERSONAS.length));
  const start = hashSeed(articleId) % PERSONAS.length;
  const out = [];
  const used = new Set();
  for (let i = 0; out.length < n && i < PERSONAS.length * 2; i++) {
    const p = PERSONAS[(start + i * 7) % PERSONAS.length];
    if (used.has(p.name)) continue;
    used.add(p.name);
    out.push(p);
  }
  return out;
}

module.exports = { PERSONAS, pickPersonas, hashSeed };
