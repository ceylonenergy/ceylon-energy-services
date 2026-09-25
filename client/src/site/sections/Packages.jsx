import { PACKAGES } from '../content.js';

export default function Packages() {
  return (
    <section id="our-packages" className="wrap-dark pad">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow gold center">Bundled Solutions</p>
          <h2 className="section-title reveal">Our Packages</h2>
          <p className="lede reveal">Pre-scoped packages that bring design, supply and installation into one line item.</p>
        </div>
        <div className="pkg-rail">
          {PACKAGES.map((pkg, i) => (
            <div className="pkg-card reveal" key={pkg.title}>
              <div className="pkg-media">
                <img src={pkg.image} alt={pkg.alt} loading="lazy" />
              </div>
              <div className="pkg-info">
                <span className="pkg-num">PKG · {String(i + 1).padStart(2, '0')}</span>
                <h5>{pkg.title}</h5>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
