// Enamad trust seal (Iranian e-commerce badge; required for the Iranian payment option).
// Must stay byte-for-byte as issued by enamad.ir: do not convert to JSX, and never add
// rel="noopener noreferrer" (it breaks verification).
const ENAMAD_SEAL_HTML =
  "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=7602313&Code=yceNfYPpnp6GMdLe41fcyAgvQDAtT09E'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=7602313&Code=yceNfYPpnp6GMdLe41fcyAgvQDAtT09E' alt='' style='cursor:pointer' code='yceNfYPpnp6GMdLe41fcyAgvQDAtT09E'></a>";

export function EnamadSeal({ className }: { className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: ENAMAD_SEAL_HTML }} />;
}
