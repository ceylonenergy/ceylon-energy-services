/**
 * The website's fixed text, in one place. Everything the admin panel
 * manages (projects, awards, documents) comes from the API instead.
 */

export const NAV_LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'what-we-do', label: 'Products' },
  { id: 'our-packages', label: 'Packages' },
  { id: 'our-projects', label: 'Projects' },
  { id: 'awards', label: 'Awards' },
  { id: 'company-profile', label: 'Attachments' },
  { id: 'contact', label: 'Contact' },
];

export const EXTERNAL_LINKS = [
  { label: 'CRM', href: 'https://ceylon-crm.vercel.app/#/' },
  { label: 'Portal', href: 'https://spec-site-shk.vercel.app/' },
];

export const HERO_SLIDES = [
  { src: '/assets/images/hero/solar-hero.png', alt: 'Rows of solar panels under a clear blue sky' },
  { src: '/assets/images/slider/slider-4.jpg', alt: 'Colombo city skyline lit up at dusk' },
];

export const HERO_STATS = [
  { value: '10+', label: 'Years Experience' },
  { value: '500+', label: 'Completed Projects' },
  { value: '06', label: 'Service Disciplines' },
];

export const ABOUT_FACTS = [
  { title: 'Solar PV', text: 'Design, install & maintain' },
  { title: 'Lightning Protection', text: 'Certified systems' },
  { title: 'Security', text: 'CCTV & sensor networks' },
  { title: 'Structural', text: 'Roofing & roller doors' },
];

export const SOLAR_TYPES = [
  {
    icon: 'plug',
    title: 'On-Grid Solar',
    text: 'Connected straight to the utility grid with no batteries — the most affordable option. Extra power is exported back to the grid, though the system shuts off during a power cut for safety.',
  },
  {
    icon: 'battery',
    title: 'Off-Grid Solar',
    text: 'A fully independent system built around battery storage, for sites with no grid access. All power is generated, stored and used on site — ideal for remote homes and estates.',
  },
  {
    icon: 'cycle',
    title: 'Hybrid Solar',
    text: 'Grid connection plus battery backup in one system. Solar powers the home first, batteries take over during outages, and the grid tops up when needed — steady power and long-term savings.',
  },
];

export const BRAND_GROUPS = [
  { icon: 'panel', label: 'Solar PV Modules', brands: ['JA Solar', 'Jinko Solar', 'Canadian Solar'] },
  { icon: 'inverter', label: 'Inverters', brands: ['Solis', 'Growatt', 'GoodWe', 'Deye', 'SolaX Power'] },
  { icon: 'cable', label: 'DC (6mm) / AC Cables', brands: ['Leader', 'LAPP', 'Kelani Cables'] },
  { icon: 'shieldBolt', label: 'Surge Protection', brands: ['Suntree', 'BENY', 'Orange Electric', 'Sierra Cables'] },
  { icon: 'roof', label: 'Roof Structure', brands: ['Swisstek', 'Alumex'] },
  { icon: 'battery', label: 'Battery', brands: ['Rosen', 'Eastman Energy', 'Solis LiFePO4', 'GoodWe'] },
];

export const HIGHLIGHTS = [
  { icon: 'shieldCheck', title: 'Quality Products', text: 'Certified & genuine stock' },
  { icon: 'gauge', title: 'Reliable Performance', text: 'Field-tested in Sri Lanka' },
  { icon: 'wrench', title: 'Expert Support', text: 'Sizing to after-sales care' },
  { icon: 'bulb', title: 'Sustainable Future', text: 'Powering a greener Ceylon' },
];

export const PACKAGES = [
  { title: 'Electric Bikes', image: '/assets/images/solar-packages/ces-electric.jpg', alt: 'Electric bikes Package' },
  { title: 'Roof Structure', image: '/assets/images/solar-packages/ces-roofing.jpg', alt: 'Roof Structure Package' },
  { title: 'Smarthouse', image: '/assets/images/solar-packages/ces-smarthouse.jpg', alt: 'Smarthouse Package' },
  { title: 'Solar', image: '/assets/images/solar-packages/ces-solar.jpg', alt: 'Solar Package' },
  { title: 'Solar Services', image: '/assets/images/solar-packages/ces-solar-services.png', alt: 'Solar Services Package' },
  { title: 'Structural Design', image: '/assets/images/solar-packages/ces-structural-design.png', alt: 'Structural Design Package' },
];

export const CONTACT = {
  addressLines: ['World Trade Center, Level 26 & 34,', 'East Tower, Echelon Square, Colombo 00100'],
  phones: [
    { label: '0771 60 96 88', href: 'tel:0771609688' },
    { label: '0113 65 45 65', href: 'tel:0113654565' },
  ],
  emails: ['info@ceylonenergyservices.com', 'sales@ceylonenergyservices.com'],
  socials: [
    { label: 'Facebook', icon: 'fa-facebook', href: 'https://www.facebook.com/?checkpoint_src=any' },
    { label: 'Instagram', icon: 'fa-instagram', href: 'https://www.instagram.com/ceylon_energy/' },
  ],
};
