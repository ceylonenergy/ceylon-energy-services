import Icon, { Bolt } from '../Icon.jsx';
import { BRAND_GROUPS, HIGHLIGHTS } from '../content.js';

export default function Products() {
  return (
    <section id="what-we-do" className="wrap-panel pad">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow gold center">Trusted Brands</p>
          <h2 className="section-title reveal">Products We Install</h2>
          <p className="lede reveal">
            Every installation is only as good as what goes into it. Here's a transparent look at the tier-one global and local
            brands we specify — chosen for certified performance, strong warranty backing and a proven track record on Sri Lankan
            rooftops.
          </p>
        </div>

        <div className="brand-groups">
          {BRAND_GROUPS.map((group) => (
            <div className="brand-row reveal" key={group.label}>
              <div className="brand-tag">
                <Icon name={group.icon} />
                <span>{group.label}</span>
              </div>
              <div className="brand-list">
                {group.brands.map((brand) => (
                  <span className="brand-chip" key={brand}>
                    <span className="chip-mark">
                      <Bolt />
                    </span>
                    <span className="chip-name">{brand}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="products-highlights">
          {HIGHLIGHTS.map((h) => (
            <div className="hl" key={h.title}>
              <Icon name={h.icon} />
              <div>
                <b>{h.title}</b>
                {h.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
