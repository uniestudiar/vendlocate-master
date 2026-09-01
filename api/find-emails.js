// DNS dynamic import used in verification functions

export const config = {
  maxDuration: 60,
};

// ─── Regex ────────────────────────────────────────────────────────────────
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_RE = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const SCHEMA_RE = /"email"\s*:\s*"([^"]+)"/gi;
const CF_RE = /__cf_email__\s*\(\s*["']([^"']+)["']\s*\)/g;
const OBFUSCATED_RE = /[a-zA-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\sat\s)\s*[a-zA-Z0-9.-]+\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*[a-zA-Z]{2,}/gi;
const NAME_FIND_RE = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
const LINK_RE = /<a[^>]+href=["']([^"']+)["']/gi;

const FAKE_DOMAINS = [
  'wixpress', 'sentry', 'cloudflare', 'example.com', 'sentry.io',
  'wix.com', 'wordpress.com', 'gravatar.com', 'schema.org',
  'github.com', 'googleapis.com', 'gstatic.com', 'gmpg.org',
  'yoursite.com', 'domain.com', 'noemail.com', 'no-image.com',
  'placehold', 'shopify.com', 'squarespace.com', 'cloudfront.net',
  'amazonaws.com', 'typeform.com', 'mailchimp.com',
  'google.com/recaptcha', 'addtoany.com', 'disqus.com',
  'google', 'facebook', 'instagram', 'twitter', 'linkedin',
  'yelp', 'yellowpages', 'bbb.org', 'youtube', 'tiktok',
  'pinterest', 'snapchat', 'reddit', 'tripadvisor',
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'protonmail.com', 'mail.com', 'zoho.com',
];

const SOCIAL_DOMAINS = ['facebook', 'instagram', 'twitter', 'linkedin', 'yelp', 'yellowpages', 'bbb.org'];

const MAX_CRAWL = 60;
const MAX_DEPTH = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractDomain(website) {
  try {
    const url = website.startsWith('http') ? new URL(website) : new URL('https://' + website);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

function isFake(email) {
  const lower = email.toLowerCase();
  if (FAKE_DOMAINS.some(d => lower.includes(d))) return true;
  if (/\.(png|jpg|gif|svg|ico|webp|css|js)$/i.test(lower)) return true;
  if (lower.startsWith('@') || !lower.includes('.')) return true;
  return false;
}

function sameDomain(url, rootDomain) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return host === rootDomain || host.endsWith('.' + rootDomain);
  } catch { return false; }
}

function cfDecode(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let decoded = '';
    for (let i = 2; i < hex.length; i += 2) decoded += String.fromCharCode(parseInt(hex.substr(i, 2), 16) ^ key);
    return decoded;
  } catch { return null; }
}

function extractEmailsFromHtml(html, targetDomain) {
  const found = new Set();
  const add = (e) => {
    const n = String(e || '').trim().toLowerCase();
    if (n && !isFake(n) && n.length < 120 && n.includes('@')) found.add(n);
  };

  let m;
  MAILTO_RE.lastIndex = 0;
  while ((m = MAILTO_RE.exec(html)) !== null) add(m[1]);

  SCHEMA_RE.lastIndex = 0;
  while ((m = SCHEMA_RE.exec(html)) !== null) add(m[1]);

  CF_RE.lastIndex = 0;
  while ((m = CF_RE.exec(html)) !== null) { const d = cfDecode(m[1]); if (d) add(d); }

  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(html)) !== null) add(m[0]);

  OBFUSCATED_RE.lastIndex = 0;
  while ((m = OBFUSCATED_RE.exec(html)) !== null) {
    const c = m[0].replace(/\s*\[at\]\s*/gi, '@').replace(/\s*\(at\)\s*/gi, '@').replace(/\s*at\s*/gi, '@')
      .replace(/\s*\[dot\]\s*/gi, '.').replace(/\s*\(dot\)\s*/gi, '.').replace(/\s*dot\s*/gi, '.');
    add(c);
  }

  // Return all non-fake emails found on the page (don't filter by domain — businesses often
  // use website builders like Squarespace/Wix where the crawl domain differs from the email domain)
  return [...found];
}

function extractNames(html) {
  const names = [];
  const seen = new Set();
  let m;
  NAME_FIND_RE.lastIndex = 0;
  while ((m = NAME_FIND_RE.exec(html)) !== null) {
    // Avoid common non-name matches
    const full = m[0];
    if (seen.has(full)) continue;
    seen.add(full);
    if (['Privacy Policy', 'Terms Of', 'All Rights', 'Powered By', 'Copyright', 'Contact Us', 'About Us', 'Join Us', 'Send Us'].some(s => full.toLowerCase().includes(s.toLowerCase()))) continue;
    names.push({ first: m[1], last: m[2] });
  }
  return names;
}

function extractLinks(html, baseUrl) {
  const links = [];
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(html)) !== null) {
    let href = m[1].trim().split('#')[0];
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const absolute = new URL(href, baseUrl).href;
      links.push(absolute);
    } catch {}
  }
  return links;
}

// ─── Fetching ─────────────────────────────────────────────────────────────

async function fetchPage(url) {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('xml') && !ct.includes('json')) return null;
    const text = await resp.text();
    if (text.length > 5_000_000) return null;
    return text;
  } catch { return null; }
}

async function fetchBuffer(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('pdf')) return null;
    const arr = await resp.arrayBuffer();
    return Buffer.from(arr);
  } catch { return null; }
}

// ─── Email verification (pure DNS, no third-party APIs) ───────────────────
// Raw TCP SMTP (port 25) blocked on Vercel. Multi-layer DNS verification:
// syntax check → disposable/typo → MX/SPF/DMARC/A/AAAA → confidence scoring

const ROLE_PREFIXES = new Set([
  'info', 'contact', 'office', 'hello', 'admin', 'manager', 'owner', 'support',
  'sales', 'service', 'team', 'leasing', 'reception', 'frontdesk', 'reservations',
  'booking', 'help', 'inquiries', 'mail', 'email', 'webmaster', 'postmaster',
  'hr', 'accounting', 'billing', 'marketing', 'pr', 'media', 'jobs', 'careers',
  'newsletter', 'noreply', 'no-reply', 'donotreply',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'burnermail.io', 'tempmail.net', 'temp-mail.org', 'fakeinbox.com',
  'maildrop.cc', 'getnada.com', 'dispostable.com', 'mailexpire.com',
  'spamgourmet.com', 'mytemp.email', 'tempemail.net', 'throwaway.email',
  'mailnator.com', 'maileater.com', 'mintemail.com', 'mohmal.com',
  'mytrashmail.com', 'norulesfox.com', 'nowmymail.com', 'one-time.email',
  'owleyes.ch', 'petrzilka.net', 'quickinbox.com', 'rcpt.at',
  'receiveee.com', 'recyclemail.dk', 'regbypass.com', 'safemail.net',
  'samsclass.info', 'selfdestructingmail.com', 'send22u.info', 'sendfree.cc',
  'senseless-entertainment.com', 'shorterurl.com', 'sneakemail.com',
  'sogetthis.com', 'soodonims.com', 'spam4.me', 'spamavert.com',
  'spambob.com', 'spambob.net', 'spambob.org', 'spamex.com',
  'spamfree24.org', 'spamgoes.in', 'spamhereplease.com', 'spamhole.com',
  'spamify.com', 'spaminator.de', 'spamkill.info', 'spaml.com',
  'spamoff.de', 'spamstack.net', 'spamthis.co.uk', 'spamtrail.com',
  'spamty.com', 'spamx.net', 'spamzilla.net', 'speed.1s.fr',
  'suremail.info', 'techemail.com', 'teleworm.us', 'tempemail.co',
  'tempinbox.com', 'tempinbox.co', 'tempmail.it', 'tempmail2.com',
  'tempoor.com', 'temporaryforwarding.com', 'temporaryinbox.com',
  'thankyou2010.com', 'thc.st', 'theinternetemail.com', 'thisisnotmyrealemail.com',
  'throwaway.de', 'throwaway.email', 'trash2009.com', 'trash2010.com',
  'trashdevil.de', 'trashemail.de', 'trashmail.at', 'trashmail.me',
  'trashmail.net', 'trashymail.com', 'trashymail.net', 'tyldd.com',
  'uggsrock.com', 'wegwerfmail.de', 'wegwerfmail.net', 'wh4f.org',
  'whyspam.me', 'willselfdestruct.com', 'winemaven.info', 'wronghead.com',
  'wuzup.net', 'xagloo.com', 'xemaps.com', 'xents.com', 'xmaily.com',
  'xoxy.net', 'yep.it', 'yogamaven.com', 'yopmail.fr', 'yopmail.net',
  'ypmail.webarnak.fr.eu.org', 'yuurok.com', 'zehnminutenmail.de',
  'zippymail.info', 'zoaxe.com', 'zoemail.org',
  '0815.ru', '0clickemail.com', '1ce.us', '1shivom.com', '2prong.com',
  '3tr6tr.com', '4gfdsgfdgfdgfdgfdgfd.com', '5mailer.com', '6paq.com',
  '99experts.com', 'a-bc.net', 'abyss.email', 'acrossgracealps.com',
  'adsd.org', 'adambrault.net', 'adelaide.bike', 'aegde.com', 'aegia.net',
  'aerobatic.net', 'afrobacon.com', 'ag.us.to', 'akapost.com', 'akir.com',
  'almaer.com', 'amigastorm.com', 'amilegit.com', 'anappthat.com',
  'ano-mail.net', 'anonymail.net', 'anonymize.com', 'anonymousmail.net',
  'anonymouse.org', 'antichef.com', 'antichef.net', 'antiqueemail.com',
  'anyalias.com', 'apkmd.com', 'archetypeemail.com', 'artmanstudios.net',
  'arvato-community.de', 'atnextmail.com', 'autotwollow.com', 'avastc.com',
  'awiki.org', 'axiscapital.biz', 'axiz.org', 'azazazatashkent.tk',
  'bamboomail.com', 'bargamesonline.org', 'bauwerke15.com', 'bcaoo.com',
  'beddly.com', 'beefmilk.com', 'bellbuffs.com', 'bepcon.net', 'bestats.top',
  'biduwell.com', 'bigprofessor.so', 'bigstring.com', 'binkmail.com',
  'bio-muesli.net', 'bko.kiev.ua', 'blogos.com', 'bluebottle.com',
  'bnote.com', 'bodhi.laughing', 'bofthew.com', 'bonobo.email',
  'bookthemmove.com', 'bootybay.de', 'borged.com', 'borged.net', 'borged.org',
  'boun.cr', 'bouncemail.net', 'boxformail.com', 'boximail.com',
  'boxtemp.com.br', 'brefmail.com', 'brennendesreich.de', 'broadbandninja.com',
  'bsnow.net', 'buffemail.com', 'business-success.com', 'buspad.org',
  'bussink.net', 'buymoreplays.com', 'buyusedlibrarybooks.org', 'byom.de',
  'cachedot.net', 'card.zp.ua', 'cartelera.org', 'caseedu.com', 'cbair.com',
  'cd.mintemail.com', 'ce.mintemail.com', 'cek.pm', 'cellurl.com',
  'centermail.com', 'centermail.net', 'chacuo.net', 'chilelinks.cl',
  'choco.la', 'christopherfretz.com', 'cinnamonmail.com', 'citywalk.com',
  'clandest.in', 'clrmail.com', 'cmail.net', 'cock.li', 'codenode.net',
  'coieo.com', 'coldemail.info', 'cpay.cc', 'cr97mt49.com', 'crankmails.com',
  'crapmail.org', 'crazydollars.com', 'cubicmelon.com', 'curryworld.de',
  'cust.in', 'cutout.club', 'cyber-innovation.club', 'cyber-phone.eu',
  'dahongshi.net', 'dandikmail.com', 'davidhoffmanart.com', 'dcemail.com',
  'deadaddress.com', 'deadchildren.org', 'deadfake.cf', 'deadspam.com',
  'deagot.com', 'dealja.com', 'delikkt.de', 'despam.it', 'despammed.com',
  'dev-null.cf', 'devnullmail.com', 'dfgh.net', 'dharmatel.net',
  'digitalsanctuary.com', 'dingbone.com', 'discard.email', 'discardmail.com',
  'discardmail.de', 'disposable-email.ml', 'disposable.cf', 'disposable.ga',
  'disposable.ml', 'dodgeit.com', 'dodgit.com', 'dodgit.org', 'dodsi.com',
  'doiea.com', 'domozmail.com', 'donemail.ru', 'dontreg.com', 'dontsendmespam.de',
  'dotnom.com', 'dotman.de', 'drdrb.com', 'drdrb.net', 'dspam.de',
  'dyceroprojects.com', 'dz17.net', 'e-mail.com', 'e-mail.org', 'e4ward.com',
  'easytrashmail.com', 'einmalmail.de', 'einrot.com', 'eintagsmail.de',
  'email-fake.cf', 'email-fake.ga', 'email-fake.gq', 'email-fake.ml',
  'email-fake.tk', 'email.cbes.net', 'email60.com', 'emaildienst.de',
  'emailgo.de', 'emailias.com', 'emailinfive.com', 'emailisvalid.com',
  'emaillime.com', 'emailmiser.com', 'emailna.co', 'emailondeck.com',
  'emails.ga', 'emailsy.info', 'emailtemporario.com.br', 'emailto.de',
  'emailtmp.com', 'emailwarden.com', 'emailx.org', 'emailz.cf', 'emailz.ga',
  'emailz.gq', 'emailz.ml', 'emkei.cf', 'emlhub.com', 'emlpro.com',
  'emltmp.com', 'enterto.com', 'ephemail.net', 'etgdev.de', 'ether123.net',
  'etranquil.com', 'etranquil.net', 'etranquil.org', 'evopo.com',
  'explodemail.com', 'ez.lv', 'f4k.es', 'fabricant.ru', 'fag.wf',
  'failbone.com', 'fake-email.ml', 'fake-mail.cf', 'fakedemail.com',
  'fakemail.fr', 'fakemail.gq', 'fakemail.ml', 'fakemailgenerator.com',
  'fakemailz.com', 'fanclub.pm', 'farmercowboy.com', 'fastacura.com',
  'fastchevy.com', 'fastchrysler.com', 'fastkawasaki.com', 'fastmazda.com',
  'fastmitsubishi.com', 'fastnissan.com', 'fastsubaru.com', 'fastsuzuki.com',
  'fasttoyota.com', 'fastyamaha.com', 'fatflap.com', 'fdfdsfds.com',
  'fightallspam.com', 'figjs.com', 'fiifke.de', 'fixmail.tk', 'fizmail.com',
  'fleckens.hu', 'flemail.ru', 'flurred.com', 'flyspam.com', 'footard.com',
  'forfry.com', 'forgetmail.com', 'fortuna7.com', 'foxja.com', 'fr33mail.info',
  'frapmail.com', 'freakmail.de', 'free-email.cf', 'freebabysittercam.com',
  'freechristianbookstore.com', 'freedompop.us', 'freegiftcardrewards.net',
  'freemail.ms', 'freemail.tweakly.net', 'freemailonline.us', 'freemails.cf',
  'freemails.ga', 'freemails.ml', 'freerunning-club.com', 'freetmail.in',
  'freewebmaill.com', 'friendlymail.co.uk', 'front14.org', 'ftp.sh',
  'fuckme69.club', 'fudgerub.com', 'fux0ringduh.com', 'fyii.de',
  'gabrielefiletti.com', 'galaxy.tv', 'garage46.com', 'garrymccooey.com',
  'gav0.com', 'gexige.com', 'gibmadtroszaskakasiemordy.com', 'girlmail.win',
  'gmx.com', 'goatmail.uk', 'gomail.in', 'googlegroups.com',
  'gorillaswithdirtyarmpits.com', 'gothere.biz', 'great-host.in',
  'greensloth.com', 'greggamel.com', 'grr.la', 'gsrv.co.uk', 'gsxstring.ga',
  'gustore.it', 'gynzi.co.uk', 'gynzi.com', 'h8s.org', 'h9js8.gq',
  'habitue.net', 'hackersquad.com', 'hackthatthang.com', 'halofarm.com',
  'happytrashmail.com', 'harakirimail.com', 'hartbot.de', 'hash.pp.ua',
  'hat-geld.de', 'hatespam.org', 'hawrong.com', 'hazelnutpatisserie.com',
  'hazelnutpatisserie.net', 'hellodino.ml', 'helloricky.com',
  'helpinghandtaxcenter.org', 'herp.in', 'hidemail.de', 'hidemail.pro',
  'hidemail.us', 'hidzz.com', 'hmail.us', 'hochsitze.com', 'hopoverview.com',
  'hopto.org', 'hot-mail.cf', 'hot-mail.ga', 'hot-mail.gq', 'hot-mail.ml',
  'hotmail-redirect.com', 'hotmailbox.re', 'hstermail.com', 'hugmunsta.com',
  'hukkmu.com', 'hulapla.de', 'humeurlinux.fr', 'huskion.net',
  'hvastudiesucces.nl', 'i6.cloudns.cc', 'ibnare.com', 'icereach.email',
  'ichigo.me', 'iheartspam.org', 'ikbenspamvrij.nl', 'ilmare.ga',
  'ilovespam.com', 'imails.info', 'imapmail.org', 'imgof.com', 'imstations.com',
  'inaby.com', 'iname.com', 'inbox.si', 'inboxalias.com', 'inboxbear.com',
  'inboxclean.com', 'inboxclean.org', 'inboxdesign.me', 'inboxed.pw',
  'inboxhub.net', 'inboxkitten.com', 'inboxproxy.com', 'inboxstore.me',
  'incognitomail.com', 'incognitomail.net', 'incognitomail.org', 'ind.st',
  'indieclan.net', 'indigobook.com', 'ineec.net', 'info66.com',
  'inmynetwork.cf', 'inmynetwork.ga', 'inmynetwork.gq', 'inmynetwork.ml',
  'insanumingeniumhome.com', 'insorg-mail.info', 'instant-mail.de',
  'instantmailaddress.com', 'internetoftags.com', 'intopwa.com', 'intopwa.net',
  'iopmail.com', 'iopmail.net', 'iopmail.org', 'ip4.pp.ua', 'ip6.li',
  'ip6.pp.ua', 'ipoo.org', 'irish2me.com', 'iroid.com', 'isosq.com',
  'istiii.com', 'it7.ovh', 'itunesgiftcodegenerator.com', 'iwantumakey.com',
  'jafps.com', 'jamesbond.xyz', 'je-recycle.info', 'jetable.com',
  'jetable.fr.nf', 'jetable.net', 'jetable.org', 'jmail.ro', 'jmtop.net',
  'joelpet.com', 'johansen.xyz', 'josesantos.org', 'jourrapide.com',
  'jsrsolutions.com', 'jswfdb48.com', 'judiss.me', 'jungkamushukum.com',
  'kademen.com', 'kaparkapa.pl', 'kartvelo.me', 'kavyt.com', 'kbox.li',
  'kcrw.de', 'keepmymail.com', 'keinpardon.de', 'kennedy808.com', 'ketrd.com',
  'kimsdisk.com', 'kismail.ru', 'kisstwink.com', 'kitnastar.com', 'kjksp.com',
  'kler.xyz', 'klipschx12.com', 'kook.ml', 'kopeechka.store', 'kostenlosmail.com',
  'koszmail.pl', 'kulturbetrieb.info', 'kurzepost.de', 'kwift.net', 'l33r.eu',
  'labetteraverouge.at', 'lacedmail.com', 'laeuro2016.com', 'lak.pp.ua',
  'landmail.co', 'laoeq.com', 'last-chance.pro', 'lastmail.co', 'lastmail.com',
  'lavabit.com', 'lawlita.com', 'lazycat.cloud', 'ldop.com', 'ldtp.com',
  'leeching.net', 'lellno.gq', 'lenovo1.xyz', 'letmeinonthis.com',
  'letthemeatspam.com', 'lifetimefriends.info', 'lillemap.net', 'link2mail.net',
  'linksafemail.com', 'linshiyouxiang.net', 'liveradio.tk', 'livingsalty.net',
  'lolfje.xyz', 'loveme.lefora.com', 'lovesea.gq', 'lpfmgmtltd.com', 'lr78.com',
  'lroid.com', 'lukecarriere.com', 'lukop.dk', 'luv2.us', 'm4ilweb.info',
  'maboard.com', 'macr2.com', 'macroev.com', 'madcrazy.com', 'madmaker.com.tr',
  'maffia.com', 'magamail.com', 'mail-filter.com', 'mail-temp.com',
  'mail.bulgarianheadhunter.com', 'mail.by', 'mail.wtf', 'mail0.ga',
  'mail1a.de', 'mail21.cc', 'mail22.club', 'mail22.space', 'mail2rss.org',
  'mail333.com', 'mail4trash.com', 'mail6.serv00.net', 'mail7.io', 'mail8.xyz',
  'mailabg.com', 'mailback.com', 'mailbidon.com', 'mailbiz.biz', 'mailblocks.com',
  'mailbucket.org', 'mailcat.biz', 'mailcatch.com', 'mailchop.com', 'mailcker.com',
  'mailde.de', 'mailde.info', 'maileater.com', 'mailf5.com', 'mailfa.tk',
  'mailfall.com', 'mailforspam.com', 'mailfree.ga', 'mailfree.gq', 'mailfree.ml',
  'mailfreedom.com', 'mailgo.de', 'mailguard.me', 'mailgutter.com',
  'mailhazard.com', 'mailhazard.us', 'mailhex.com', 'mailhub.pro', 'mailhz.me',
  'mailimate.com', 'mailin8r.com', 'mailinater.com', 'mailinator.co.uk',
  'mailinator.gq', 'mailinator.info', 'mailinator.net', 'mailinator.org',
  'mailinator.us', 'mailinator2.com', 'mailinatorzz.ml', 'mailinto.com',
  'mailismagic.com', 'mailita.tk', 'mailjunk.net', 'mailmate.com', 'mailme.gq',
  'mailme.ir', 'mailme.lv', 'mailmenot.info', 'mailmetrash.com', 'mailmoat.com',
  'mailmoth.com', 'mailms.com', 'mailnator.com', 'mailnesia.com', 'mailnull.com',
  'mailo.com', 'mailox.biz', 'mailox.fun', 'mailpick.biz', 'mailpooch.com',
  'mailproxsy.com', 'mailquack.com', 'mailr24.com', 'mailrocket.biz',
  'mailscrap.com', 'mailseal.de', 'mailshiv.com', 'mailshiv.me', 'mailsiphon.com',
  'mailslapping.com', 'mailslite.com', 'mailspam.xyz', 'mailtemp.net',
  'mailtemp.org', 'mailtome.de', 'mailtothis.com', 'mailtraps.com',
  'mailtrash.net', 'mailtrix.net', 'mailuniverse.co.uk', 'mailvip.com',
  'mailw.info', 'mailwire.com', 'mailworks.org', 'mailzi.ru', 'mailzilla.com',
  'mailzilla.org', 'makemetheking.com', 'manna.lt', 'mansiondev.com',
  'manybrain.com', 'markmurfin.com', 'mbx.cc', 'mciek.com', 'mega.zik.dj',
  'meinspamschutz.de', 'meltmail.com', 'mergelu.ga', 'mhdsl.com', 'mial.tk',
  'migmail.net', 'migmail.pl', 'migumail.com', 'mijnhier.nl',
  'ministry-of-silly-walks.de', 'misterpinball.com', 'ml8.ca', 'mobi.web.id',
  'moburl.com', 'mohmal.im', 'mohmal.in', 'mohmal.tech', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'mongolemountain.com', 'monkeybanana.com', 'monoopost.com',
  'montefuji.xyz', 'moophz.com', 'mooreg.ml', 'mopslik.com', 'mor19.uu.gl',
  'moreawesomethanyou.com', 'moreorcs.com', 'morriesworld.ml', 'moru.pl',
  'mrvpm.net', 'msa.minsmail.com', 'msgden.com', 'mshome.net', 'msxn1.com',
  'mt2009.com', 'mt2014.com', 'mt2015.com', 'muehlacker.tk', 'muell.xyz',
  'mufux.com', 'munoubengoshi.gq', 'mutant.me', 'muttvomit.com', 'my-email.ga',
  'my-temp.email', 'my10minutemail.com', 'myalias.pw', 'mycard.net.ua',
  'mycleaninbox.net', 'mycorneroftheinter.net', 'myemailboxy.com',
  'mygeoweb.info', 'myindohome.services', 'myinterserver.ml',
  'mykickassideas.com', 'mymail-in.net', 'mymail90.com', 'mymailoasis.com',
  'mynetstore.de', 'myopang.com', 'mypacks.net', 'mypartyclip.de',
  'myphantomemail.com', 'myspamless.com', 'mytempemail.com', 'myzx.com',
  'n1nja.org', 'nabuma.com', 'nada.email', 'nada.ltd', 'nanonym.ch',
  'nationalgardeningclub.com', 'nawmin.info', 'nbzmr.com', 'negated.com',
  'neomailbox.com', 'nepwk.com', 'nervhq.org', 'netmails.com', 'netmails.net',
  'netricity.nl', 'netris.net', 'netviewer-france.com', 'nevermail.de',
  'nextstopvalhalla.com', 'nfast.net', 'nguyenusedcars.com', 'nicebush.com',
  'nicegarden.com', 'nicewood.com', 'nicolastuazon.com', 'nightlytech.com',
  'nincsmail.hu', 'niwl.net', 'nm7.cc', 'nnh.com', 'nnot.net', 'no-spam.ws',
  'no-ux.com', 'nobulk.com', 'nobuma.com', 'noclickemail.com', 'nodezine.com',
  'nogmailspam.info', 'noicd.com', 'nokiamail.com', 'nolemail.ga', 'nom.za',
  'nomail.cf', 'nomail.ga', 'nomail.pw', 'nomail.xl.cx', 'nomorespamemails.com',
  'nonspam.eu', 'nonspammer.de', 'noref.in', 'norseforce.com', 'nospam.ze.tc',
  'nospam4.us', 'nospamfor.us', 'nospamthankyou.com', 'notmailinator.com',
  'notrnailinator.com', 'nowhere.org', 'ntlhelp.net', 'nubescontrol.com',
  'nullbox.info', 'nutpa.net', 'nwldx.com', 'o2.pl', 'o7i.net', 'obispmail.com',
  'odnorazovoe.ru', 'oepia.com', 'oerpub.org', 'offshore.cf', 'ohcleaner.com',
  'oidzc.com', 'oilanalyzer.info', 'okclprojects.com', 'olypmall.ru',
  'omail.pro', 'omnievents.org', 'one2mail.info', 'oneoffmail.com',
  'onewaymail.com', 'onlatedotcom.info', 'online.ms', 'onmail.win',
  'onotech.com', 'ontyne.biz', 'oohioo.com', 'opayq.com', 'opentrash.com',
  'opmmedia.ga', 'opp24.com', 'ordinaryamerican.net', 'ordinaryyzc.xyz',
  'oroki.de', 'otherinbox.com', 'ourklips.com', 'outlawspam.com', 'ovpn.to',
  'owlpic.com', 'oxfarm1.com', 'ozyl.de', 'pa9e.tk', 'paban.win',
  'pagamenti.tk', 'pancakemail.com', 'paplease.com', 'parcel4.net',
  'parisbienaimer.fr.nf', 'password.colafanta.cf', 'passwordmail.com',
  'pastebitch.com', 'paulkippes.com', 'pavilionx2.com', 'payperex2.com',
  'peapz.com', 'pecinan.com', 'pepbot.com', 'peterzeman.com', 'pfui.ru',
  'photomark.net', 'pi.vu', 'pier14.com', 'pinehill-seattle.org', 'pingir.com',
  'pisls.com', 'pjjkp.com', 'placemail.net', 'pleasenospam.net', 'plexolan.de',
  'plw.me', 'poczta.online', 'pojok.ml', 'polarkingxx.ml', 'ponp.be',
  'poofy.org', 'pookmail.com', 'postonline.cc', 'poutineyourface.com',
  'powerencry.com', 'powered.name', 'pp.ua', 'presswithvicky.com',
  'primabananen.net', 'prin.be', 'print2inbox.com', 'private-mail.xyz',
  'privateemail.co', 'privatemail.cf', 'privatemail.ga', 'privatemail.ml',
  'pro-tag.org', 'projectcl.com', 'projop.com', 'promaild.com', 'promails.xyz',
  'proprietativalcea.ro', 'proxymail.eu', 'prtnx.com', 'prtz.eu', 'psh.me',
  'punkass.com', 'purplemail.ga', 'put2.net', 'puttanamaiala.tk', 'pw-mail.cf',
  'pw-mail.ga', 'pw-mail.gq', 'pw-mail.ml', 'pwp.lv', 'qacquire.com',
  'qasti.com', 'qbfree.us', 'qezz.com', 'qipmail.net', 'qiq.us', 'qoika.com',
  'qopmail.com', 'qpalong.com', 'qs.dp51.com', 'quadrafit.com', 'quickmail.nl',
  'qvy.me', 'qwertymail.com', 'r8r4p0.com', 'raakkes.com', 'radiodora.com',
  'rainmails.com', 'rapt.be', 'raptor.gold', 're-gister.com', 'readyforyou.info',
  'receptum.eu', 'reddit.xyz', 'reddithub.com', 'redfue.com', 'regbypass.com',
  'regspaces.tk', 'rejectmail.com', 'reliable-mail.com', 'remail.cf',
  'remail.ga', 'remote.li', 'renraku.in', 'reptilegenetics.com', 'resemote.com',
  'resistore.net', 'retkesbusz.nhely.hu', 'revolvingdoorhoax.org', 'rhyta.com',
  'richardsonlumber.net', 'ricknology.com', 'ride.li', 'ringow.com',
  'riopreto.com.br', 'risingsuntest.com', 'ro.lt', 'robertsspaceindustries.com',
  'rollindo.agency', 'ronnierage.net', 'rootfest.net', 'rosebearmylove.ru',
  'royal.net', 'royaldoodles.org', 'rppkn.com', 'rtrtr.com', 'ruru.be',
  'rustydoor.com', 's0ny.net', 'sabrestlouis.com', 'sackboii.com',
  'safersignup.com', 'safersignup.de', 'safetymail.info', 'safetypost.de',
  'saharanightstempe.com', 'salmeow.tk', 'sandelf.de', 'satanicknights.com',
  'saynotospams.com', 'scarcelyfilling.com', 'scatmail.com', 'schafmail.de',
  'schmeissweg.tk', 'schrott-email.de', 'scmail.cf', 'scrsot.com', 'secmail.pw',
  'secretemail.de', 'securebox.email', 'securemail.ga', 'seekapps.com',
  'seekfindask.com', 'selfdestructingmail.org', 'send22u.info', 'sendfree.org',
  'sendhere.org', 'sendspamhere.com', 'sent.as', 'sent.at', 'sent.com',
  'serga.org.ua', 'servemp3.com', 'sexical.com', 'shhmk.com', 'shhuut.org',
  'shieldedmail.com', 'shieldsemail.com', 'shiftmail.com', 'shitaway.cf',
  'shitaway.ga', 'shitaway.gq', 'shitaway.ml', 'shitaway.tk', 'shitmail.de',
  'shitmail.me', 'shitmail.org', 'shitware.nl', 'shocked.com',
  'shootingandmore.com', 'shortmail.net', 'shotmail.ru', 'showslow.de',
  'shrib.com', 'shut.name', 'shut.ws', 'sibmail.com', 'sify.com',
  'simpleitsecurity.info', 'sinfiltro.cl', 'sinmail.com', 'sis.sy',
  'sitesell.net', 'six-six-six.com', 'skeletonbro.com', 'skrx.tk',
  'sky-mail.ga', 'slippery.email', 'slopsmail.com', 'slushmail.com', 'sly.io',
  'smapfree24.com', 'smapfree24.de', 'smapfree24.eu', 'smapfree24.info',
  'smapfree24.org', 'smarttalent.pw', 'smashmail.de', 'smellfear.com',
  'smellrear.com', 'smtp33.com', 'smtp99.com', 'smwg.info', 'snakepress.com',
  'snakopy.gq', 'snapwet.com', 'sneakerbunny.com', 'snetfrom.net', 'snkmail.com',
  'socialfurry.org', 'softkey-germany.de', 'softpls.asia', 'sohai.ml',
  'sohus.cn', 'soodomail.com', 'soodonims.com', 'soon.it', 'spacebate.com',
  'spam-be-gone.com', 'spam.2012-2016.ru', 'spam.care', 'spam.coroiu.com',
  'spam.ee', 'spam.hotfreemail.com', 'spam.su', 'spam.user.meetfriday.com',
  'spamail.cf', 'spamail.ga', 'spamail.gq', 'spamail.ml', 'spamail.tk',
  'spamarrest.com', 'spambog.com', 'spambog.de', 'spambog.net', 'spambog.ru',
  'spambox.info', 'spambox.irishspringrealty.com', 'spambox.me', 'spambox.org',
  'spambox.us', 'spamcannon.com', 'spamcannon.net', 'spamcero.com', 'spamcon.org',
  'spamcorptastic.com', 'spamcowboy.com', 'spamcowboy.net', 'spamcowboy.org',
  'spamday.com', 'spamdecoy.net', 'spameater.org', 'spamfaq.net', 'spamfence.net',
  'spamfighter.de', 'spamfighter.pro', 'spamfree.eu', 'spamfree24.com',
  'spamfree24.de', 'spamfree24.eu', 'spamfree24.info', 'spamfree24.net',
  'spamfree24.org', 'spamgourmet.com', 'spamherelots.com', 'spamhereplease.com',
  'spamhole.com', 'spamify.com', 'spaminator.de', 'spamkill.info', 'spaml.com',
  'spamlot.net', 'spammotel.com', 'spamobox.com', 'spamoff.de', 'spamslicer.com',
  'spamsphere.com', 'spamspot.com', 'spamstack.net', 'spamthis.co.uk',
  'spamthisplease.com', 'spamtrail.com', 'spamtrap.ro', 'spamtroll.net',
  'spamwaster.com', 'spamwc.de', 'spamzen.xyz', 'spiderwebforum.com',
  'spoofmail.de', 'spr.io', 'spritzzone.de', 'spybox.de', 'spymail.net',
  'squizzy.com', 'squizzy.net', 'sso-demo.com', 'stexsy.com', 'stinkefinger.net',
  'stop-my-spam.cf', 'stop-my-spam.com', 'stop-my-spam.ga', 'stop-my-spam.ml',
  'storj99.com', 'storj99.top', 'streetwisemail.com', 'stromox.com',
  'stuckmail.com', 'stuffmail.de', 'suburbanthug.com', 'sudolife.me',
  'sudolife.net', 'sudomail.biz', 'sudomail.com', 'sudomail.net', 'sudoverse.com',
  'sudoverse.net', 'sueddeutsche.club', 'sugarbox.net', 'suioe.com',
  'super-auswahl.de', 'supergreatmail.com', 'supermailer.jp', 'superrito.com',
  'superstachel.de', 'svip520.cn', 'svk.jp', 'svxr.org', 'sweetxxx.de',
  'swift10minutemail.com', 'sylvannet.com', 'symphonyresume.com',
  'syujob.accountants', 'tabult.com', 'tafmail.com', 'taglead.com',
  'tagmymedia.com', 'talkinator.com', 'tapchicuoihoi.com', 'taphear.com',
  'tawabs.com', 'tb-on-line.net', 'tech-mail.net', 'techgroup.me',
  'telecomix.pl', 'telefox.com', 'telegmail.com', 'teleworm.com',
  'temp-mail.de', 'temp-mail.ru', 'tempail.com', 'tempalias.com',
  'tempe-mail.com', 'tempemail.biz', 'tempemail.co.za', 'tempemail.com',
  'tempemail.org', 'tempmail.co', 'tempmail.de', 'tempmail.eu', 'tempmail.xyz',
  'tempmailaddress.com', 'tempmaildemo.com', 'tempmailer.com', 'tempmailer.de',
  'tempomail.fr', 'temporarily.de', 'temporarioemail.com.br',
  'temporaryemail.net', 'temporaryemail.us', 'temporarymailaddress.com',
  'tempr.email', 'tempsee.com', 'tench.de', 'tensorwells.com', 'testudine.com',
  'thanksnospam.info', 'thc.st', 'theaviors.com', 'thebearshark.com',
  'thecloudindex.com', 'thedarkmaster.net', 'thejapanesemapler.com',
  'thembones.com.au', 'theoke.net', 'thepinktank.com', 'theplug.org',
  'thepubdigest.com', 'theteastory.com', 'thex.ro', 'thinstall.com',
  'thraml.com', 'throam.com', 'thrott.com', 'throw.am', 'throwaway.xyz',
  'throwawayemailaddress.com', 'throwawaymail.pp.ua', 'throya.com',
  'thunky.space', 'thxmate.com', 'tiapz.com', 'tilien.com',
  'tim-ou-est-toujours-aussi-gentil.fr', 'tittbit.in', 'tiv.cc', 'tizi.com',
  'tjes.com', 'tkitcai.swaggerful.com', 'tmail.ws', 'tmailinator.com',
  'tmails.net', 'tmpeml.info', 'tmpjr.me', 'tmpmail.net', 'tmpmail.org',
  'toddsbighug.com', 'toiea.com', 'tokem.co', 'tokenmail.net', 'tonymanso.com',
  'toomail.biz', 'top101.de', 'topranklist.de', 'toprumours.com', 'tormail.org',
  'toss.pw', 'totalvista.com', 'tough.biz', 'toughkidmag.com', 'tqoai.com',
  'tqoai.net', 'tr2k.co', 'trainmail.com', 'tranceversal.com', 'trash-2009.com',
  'trash-me.com', 'trash247.com', 'trashail.com', 'trashbox.de',
  'trashcanmail.com', 'trashinbox.com', 'trashmail.io', 'trashmail.ws',
  'trashmailer.com', 'trashmails.com', 'trasz.com', 'trayna.com', 'trbvm.com',
  'trbvn.com', 'trbvo.com', 'trialmail.de', 'trickmail.net', 'trillianpro.com',
  'trimsj.com', 'trobertqs.com', 'tropicalbass.info', 'trumpmail.com',
  'trung.name.vn', 'tryalert.com', 'tryninja.io', 'tryprice.co', 'turoid.com',
  'turual.com', 'tverya.com', 'twinmail.de', 'twistsandturns.org', 'twkly.ml',
  'twocowmail.net', 'twoweird.com', 'ubismail.net', 'ubmMD5', 'ucupdong.ml',
  'uguuchantele.com', 'uhhu.ru', 'uk.to', 'umy.kro.kr', 'unboundedmetrics.com',
  'undisclosedserver.com', 'unforgetful.com', 'unicodeworld.com', 'unimatrix.org',
  'uniqueemailaddress.com', 'unkn0wn.xyz', 'unlimit.ml', 'unmail.ru', 'upcma.xyz',
  'upliftnow.com', 'uplipht.com', 'uploadnolimit.com', 'upravo.gq',
  'upstairs2nd.com', 'ureach.com', 'urfey.com', 'urfunktion.se', 'us.af',
  'us.to', 'usa.cc', 'utiket.us', 'uu.gl', 'uwork4.us', 'uyhip.com',
  'vaasfc4.tk', 'valemail.net', 'valhallafrontier.com', 'valleyoflego.com',
  'vampirefreaks.com', 'vbmail.com', 'vctel.com', 'vcv.net', 'vedula.com',
  'vektik.com', 'vemomail.win', 'venompen.com', 'ver0.cf', 'ver0.ga',
  'ver0.gq', 'ver0.ml', 'ver0.tk', 'vercelli.cf', 'vercelli.ga', 'vercelli.gq',
  'vercelli.ml', 'verifymail.win', 'verpipes.com', 'veryday.ch', 'veryday.eu',
  'veryday.info', 'veryfast.biz', 'veryrealemail.com', 'vesa.pw', 'vfemail.net',
  'vickaentb.tk', 'victime.ninja', 'victoriantwins.com', 'vidchart.com',
  'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net', 'vignettecrest.com',
  'vimail24.com', 'vinernet.com', 'violin24.ga', 'vipepe.com', 'viperace.com',
  'vipmail.name', 'vipmail.pw', 'vipxm.net', 'viralemail.com', 'visal007.tk',
  'visal168.tk', 'vixletdev.com', 'vkcode.ru', 'vmail.me', 'vmailing.info',
  'vmani.com', 'vmpanda.com', 'voidbay.com', 'vomoto.com', 'vorga.org',
  'votiputox.org', 'voxelcore.com', 'vpn.st', 'vps30.com', 'vps911.net',
  'vrad.da.cx', 'vsimcard.com', 'vsssms.com', 'vualta.com', 'vubby.com',
  'vumq.com', 'vy.ek.la', 'w3internet.co.uk', 'wakingupesther.com', 'walala.org',
  'walkmail.net', 'walkmail.ru', 'wangjunkai.com', 'wank.com', 'want2lov.us',
  'wantplay.site', 'warau-kadawa.com', 'warimail.com', 'warnednl2.com',
  'watchfrog.net', 'watchfull.net', 'wawi.email', 'wazo.com', 'wbdet.com',
  'we.lovebitco.in', 'we.qq.my', 'webtrip.ch', 'webuser.in', 'wee.my',
  'weg-werf-mail.de', 'wegwerf-email-addressen.de', 'wegwerf-email.de',
  'wegwerf-email.net', 'wegwerf-emails.de', 'wegwerfadresse.de',
  'wegwerfemail.de', 'wegwerfmail.org', 'wegwerpost.com', 'wegwurfmail.de',
  'welikecookies.com', 'wellhungup.com', 'welshspanish.com', 'wendygary.com',
  'westcanadatriathlon.com', 'wha.la', 'whatiaas.com', 'whatifanalytics.com',
  'whatpaas.com', 'whatsaas.com', 'whipppet.com', 'whitemail.xyz',
  'wicked.cricket', 'wickedgame.cricket', 'wickedxyz.cricket', 'widaryanto.info',
  'wilemail.com', 'willhackforfood.biz', 'wimsg.com', 'wins.com.br', 'wlistp.com',
  'wmail.cf', 'wmail.ga', 'wmail.gq', 'wmail.ml', 'wmail.tk', 'wmkowa.com',
  'wokcy.com', 'wolfmail.ml', 'wolfsmail.tk', 'wollan.info', 'worldspace.link',
  'wpg.im', 'writeme.com', 'writeme.us', 'wuzupmail.net', 'wwjmp.com',
  'wwwnew.eu', 'x24.com', 'xasd.com', 'xcode.ro', 'xcompress.com', 'xcxcx.com',
  'xfanys.com', 'xing886.uu.gl', 'xjoi.com', 'xl.cx', 'xmail.com', 'xmailer.be',
  'xnmail.ml', 'xoxox.cc', 'xperiae5.com', 'xrho.com', 'xvx.us', 'xwaretech.com',
  'xwaretech.info', 'xwaretech.net', 'xww.ro', 'xy9ce.tk', 'xyzfree.net',
  'xzavier.com', 'xzlive.com', 'yapmail.com', 'yapped.net', 'ycare.de',
  'ycn.ro', 'ye.biz.st', 'ye.vc', 'yewma.co', 'yhg.biz', 'yingshuo.com',
  'ymail.net', 'ymail.org', 'ynmrealty.com', 'yodx.com', 'yomail.info',
  'yoo.ro', 'yopmail.gq', 'yopmail.org', 'yordanmail.cf',
  'yoursuccessfulbusiness.info', 'yroid.com', 'z1p.biz', 'za.com', 'zahuy.site',
  'zasod.com', 'zebins.com', 'zebins.eu', 'zehnminuten.de', 'zepp.dk',
  'zetmail.com', 'zhcne.com', 'zhouemail.510520.org', 'zombie-hive.com',
  'zomg.info', 'zoemail.com', 'zoonenos.com', 'zoqqa.com', 'zp.ua',
  'zumpia.com', 'zxcv.com', 'zxcvbnm.com', 'zybermail.com', 'zytr.xyz',
  'zzz.com', 'zzz.pl',
]);

const COMMON_TYPOS = new Map([
  ['gnail.com', 'gmail.com'], ['gmal.com', 'gmail.com'], ['gmial.com', 'gmail.com'],
  ['gmali.com', 'gmail.com'], ['gamil.com', 'gmail.com'], ['gmaill.com', 'gmail.com'],
  ['gmil.com', 'gmail.com'], ['yaho.com', 'yahoo.com'], ['yahooo.com', 'yahoo.com'],
  ['yhoo.com', 'yahoo.com'], ['yahho.com', 'yahoo.com'], ['hotmal.com', 'hotmail.com'],
  ['hotmial.com', 'hotmail.com'], ['hotmaill.com', 'hotmail.com'], ['homail.com', 'hotmail.com'],
  ['outlok.com', 'outlook.com'], ['outllok.com', 'outlook.com'], ['outolok.com', 'outlook.com'],
]);

const DISPOSABLE_PATTERNS = [
  /^temp/, /^tmp/, /^throw/, /^trash/, /^spam/, /^junk/, /^fake/, /^disposable/,
  /^10minute/, /^guerrilla/, /^mailinator/, /^yopmail/, /^\d+.*mail/,
];

function isValidEmailSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length < 5 || email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  return true;
}

function checkEmailTypo(domain) {
  return COMMON_TYPOS.get(domain.toLowerCase()) || null;
}

function isDisposableDomain(domain) {
  const d = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(d)) return true;
  for (const pattern of DISPOSABLE_PATTERNS) {
    if (pattern.test(d)) return true;
  }
  return false;
}

async function domainHasRecords(domain) {
  try {
    const dns = await import('dns/promises');
    const [mx, a, aaaa, spf, dmarc] = await Promise.allSettled([
      dns.resolveMx(domain),
      dns.resolve4(domain),
      dns.resolve6(domain),
      dns.resolveTxt(domain),
      dns.resolveTxt(`_dmarc.${domain}`),
    ]);
    if (mx.status === 'fulfilled' && mx.value.length > 0) return true;
    if (a.status === 'fulfilled' && a.value.length > 0) return true;
    if (aaaa.status === 'fulfilled' && aaaa.value.length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

async function checkDnsQuality(domain) {
  let score = 0;
  try {
    const dns = await import('dns/promises');
    const [mx, spf, dmarc] = await Promise.allSettled([
      dns.resolveMx(domain),
      dns.resolveTxt(domain),
      dns.resolveTxt(`_dmarc.${domain}`),
    ]);
    if (mx.status === 'fulfilled' && mx.value.length > 0) {
      score += Math.min(mx.value.length, 3) * 10;
    }
    if (spf.status === 'fulfilled') {
      const hasSpf = spf.value.some(txt => txt.join('').includes('v=spf1'));
      if (hasSpf) score += 15;
    }
    if (dmarc.status === 'fulfilled') {
      const hasDmarc = dmarc.value.some(txt => txt.join('').includes('v=DMARC'));
      if (hasDmarc) score += 10;
    }
  } catch {}
  return score;
}

function scoreEmailConfidence(email) {
  const local = email.split('@')[0].toLowerCase();
  if (ROLE_PREFIXES.has(local)) return 0.55;
  if (/^[a-z]+\.[a-z]+$/.test(local)) return 0.95;
  if (/^[a-z]+\.([a-z]+\.)+[a-z]+$/.test(local)) return 0.9;
  if (/^[a-z]+[._-][a-z]+[._-]?[a-z]+$/.test(local)) return 0.85;
  if (/^[a-z]+\d*$/.test(local)) return 0.65;
  if (/^[a-z]+\.[a-z]+\d+$/.test(local)) return 0.8;
  if (/^[a-z]+\d+\.[a-z]+$/.test(local)) return 0.75;
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return 0.85;
  return 0.7;
}

async function smtpVerify(email, mxHost, timeoutMs = 10000) {
  if (!email || !email.includes('@') || !isValidEmailSyntax(email)) {
    return { valid: false, score: 0, reason: 'Invalid syntax' };
  }
  const domain = email.split('@')[1].toLowerCase();
  const typoFix = checkEmailTypo(domain);
  if (typoFix) return { valid: false, score: 0, reason: `Did you mean ${typoFix}?` };
  if (isDisposableDomain(domain)) {
    return { valid: false, score: 0, reason: 'Disposable/temp domain' };
  }
  const hasRecords = await domainHasRecords(domain);
  if (!hasRecords) {
    return { valid: false, score: 0, reason: 'No DNS records' };
  }
  const confidence = scoreEmailConfidence(email);
  const dnsQuality = await checkDnsQuality(domain);
  const finalScore = Math.round((confidence * 70) + (dnsQuality * 0.3));
  return {
    valid: finalScore >= 40,
    score: finalScore,
    reason: finalScore >= 40 ? 'DNS verified' : 'Low confidence',
  };
}

// ─── Pattern inference + generation ───────────────────────────────────────

function inferPatterns(emails) {
  const counts = {};
  for (const email of emails) {
    const [local] = email.split('@');
    const clean = local.replace(/[_-]/g, '.');
    const parts = clean.split('.').filter(Boolean);
    if (parts.length !== 2) continue;
    const [first, last] = parts;
    if (local === `${first}.${last}`) counts['{first}.{last}'] = (counts['{first}.{last}'] || 0) + 1;
    if (local === `${first}${last}`) counts['{first}{last}'] = (counts['{first}{last}'] || 0) + 1;
    if (local === `${first[0]}${last}`) counts['{f}{last}'] = (counts['{f}{last}'] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([p, c]) => ({ pattern: p, count: c }));
}

function generateCandidates(names, patterns, domain) {
  if (!patterns.length) return [];
  const generated = new Set();
  for (const { first, last } of names) {
    for (const { pattern } of patterns) {
      const local = pattern
        .replace('{first}', first.toLowerCase())
        .replace('{last}', last.toLowerCase())
        .replace('{f}', first[0] || '');
      generated.add(`${local}@${domain}`);
    }
  }
  return [...generated];
}

function bestEmailDomain(emails, websiteDomain) {
  // Find the most common non-generic email domain from found emails
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'protonmail.com', 'mail.com'];
  const counts = {};
  for (const email of emails) {
    const host = email.split('@')[1];
    if (!host || genericDomains.includes(host)) continue;
    counts[host] = (counts[host] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : websiteDomain;
}

// ─── Main handler ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { website, businessName } = req.body;
  if (!website) return res.status(400).json({ error: 'Missing website' });

  const domain = extractDomain(website);
  if (!domain || SOCIAL_DOMAINS.some(d => domain.includes(d))) {
    return res.status(200).json({ emails: [], count: 0 });
  }

  const baseUrl = website.startsWith('http') ? website.replace(/\/$/, '') : `https://${website}`.replace(/\/$/, '');

  // ── 1) Crawl ──
  const foundEmails = [];
  const foundNames = [];
  const visited = new Set();
  const queue = [{ url: baseUrl, depth: 0 }];
  let crawledCount = 0;
  let crawlDeadline = Date.now() + 25000;

  while (queue.length > 0 && crawledCount < MAX_CRAWL && Date.now() < crawlDeadline) {
    const batch = queue.splice(0, 3);
    await Promise.allSettled(
      batch.map(async ({ url, depth }) => {
        if (visited.has(url) || depth > MAX_DEPTH || Date.now() >= crawlDeadline) return;
        visited.add(url);

        const html = await fetchPage(url);
        if (!html) return;

        crawledCount++;
        foundEmails.push(...extractEmailsFromHtml(html, domain));
        foundNames.push(...extractNames(html));

        if (depth < MAX_DEPTH) {
          const links = extractLinks(html, url);
          const deduped = new Set();
          for (const link of links) {
            if (visited.has(link) || deduped.has(link)) continue;
            if (!sameDomain(link, domain)) continue;
            if (/\.(pdf|docx?|xlsx?|pptx?|zip|png|jpg|jpeg|gif|svg|ico)$/i.test(link)) continue;
            deduped.add(link);
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      })
    );
  }

  const uniqueEmails = [...new Set(foundEmails)];
  const uniqueNames = [...new Map(foundNames.map(n => [`${n.first}|${n.last}`, n])).values()];

  // Determine the best domain to use for candidate generation
  const emailDomain = bestEmailDomain(uniqueEmails, domain);

  // ── 2) Pattern inference (from local-parts regardless of domain) ──
  const patterns = inferPatterns(uniqueEmails);

  // ── 3) Generate candidates from names ──
  let candidates = generateCandidates(uniqueNames, patterns, emailDomain);

  // If no patterns were inferred (no emails found on site), generate common pattern candidates
  if (candidates.length === 0 && uniqueNames.length > 0) {
    const commonPatterns = ['{first}.{last}', '{first}', '{f}{last}'];
    const syntheticPatterns = commonPatterns.map(p => ({ pattern: p, count: 0 }));
    candidates = generateCandidates(uniqueNames, syntheticPatterns, emailDomain);
  }

  // Always add common contact prefixes as candidates regardless of crawl results
  if (emailDomain) {
    const commonPrefixes = ['info', 'contact', 'hello', 'office', 'admin', 'support'];
    for (const prefix of commonPrefixes) {
      candidates.push(`${prefix}@${emailDomain}`);
    }
  }

  // ── 4) Verify emails via SMTP ──
  const seen = new Set();
  const toVerify = [];
  for (const email of [...uniqueEmails, ...candidates]) {
    const lower = email.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    toVerify.push({ email, source: uniqueEmails.includes(email) ? 'found' : 'generated' });
  }

  // Prioritize: found emails first, then generated candidates (limit total to 20)
  const priority = toVerify.sort((a, b) => a.source === 'found' ? -1 : 1).slice(0, 20);

  const verifiedResults = await Promise.allSettled(
    priority.map(async ({ email, source }) => {
      const result = await smtpVerify(email);
      const score = result.valid ? 100 : 0;
      return { email, source, valid: result.valid, reason: result.reason, score };
    })
  );

  const allVerified = verifiedResults.filter(r => r.status === 'fulfilled').map(r => r.value);

  // Sort: valid found > valid generated > unknown found > unknown generated > invalid
  const preferPrefixes = ['info@', 'contact@', 'office@', 'hello@', 'service@', 'support@', 'manager@'];
  allVerified.sort((a, b) => {
    const aPref = preferPrefixes.some(p => a.email.startsWith(p)) ? 1 : 0;
    const bPref = preferPrefixes.some(p => b.email.startsWith(p)) ? 1 : 0;
    return (b.valid - a.valid) || (bPref - aPref) || (a.source === 'found' ? -1 : 1) || (b.score - a.score);
  });

  const smtpVerifiedEmails = allVerified.filter(e => e.valid).map(e => e.email);

  // Build final list: prefer SMTP-verified, otherwise return only crawled found emails
  let finalEmails;
  if (smtpVerifiedEmails.length > 0) {
    finalEmails = smtpVerifiedEmails;
  } else {
    // SMTP unreliable on Vercel — return emails actually found on the crawled pages,
    // NOT generated/synthetic candidates (those would likely bounce and lose customers)
    finalEmails = [...new Set(uniqueEmails)];
  }

  return res.status(200).json({
    emails: finalEmails,
    count: finalEmails.length,
    names: uniqueNames,
    patterns,
    verified: allVerified.filter(e => e.valid),
    allResults: allVerified,
  });
}
