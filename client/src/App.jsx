import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

/*
 * The website and the admin panel are separate bundles, each with its
 * own stylesheet: the site's main.css and the admin's admin.css both
 * style plain elements and share class names like .btn, so they must
 * never be on the same page. Links between the two are full page loads
 * (a plain <a href>), which guarantees that.
 *
 * Visitors never download the admin panel (or pdf.js with it).
 */
const isAdminPath = window.location.pathname.startsWith('/admin');
// Start fetching the site bundle straight away rather than after React boots.
const sitePreload = isAdminPath ? null : import('./site/SitePage.jsx');

const SitePage = lazy(() => sitePreload || import('./site/SitePage.jsx'));
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<SitePage />} />
      </Routes>
    </Suspense>
  );
}
