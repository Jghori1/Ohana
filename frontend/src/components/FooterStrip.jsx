const FOOTER_STRIP = "/footer/footer-strip.jpg"; // composed from public/footer/*.png

/** The cartoon crowd banner that sits at the very bottom of every page */
export default function FooterStrip() {
  return <img className="foot-strip" src={FOOTER_STRIP} alt="" />;
}
