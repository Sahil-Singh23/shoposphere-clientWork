import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { UserAuthProvider } from "./context/UserAuthContext";
import { WishlistProvider } from "./context/WishlistContext";
import { RecentlyViewedProvider } from "./context/RecentlyViewedContext";
import Navbar from "./components/Navbar";
import BottomMenuBar from "./components/BottomMenuBar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import DriverProtectedRoute from "./components/DriverProtectedRoute";
import ChatBot from "./components/ChatBot";
import WhatsAppFloatingButton from "./components/WhatsAppFloatingButton";
import ScrollToTop from "./components/ScrollToTop";
import ToastViewport from "./components/ToastViewport";

import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Occasion from "./pages/Occasion";
import NewArrivals from "./pages/NewArrivals";
import CategoriesPage from "./pages/CategoriesPage";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import Search from "./pages/Search";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminOrderDetailPage from "./pages/admin/AdminOrderDetailPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminInventoryPage from "./pages/admin/AdminInventoryPage";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage";
import AdminDriversPage from "./pages/admin/AdminDriversPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OAuthCallback from "./pages/OAuthCallback";
import ProfileAddresses from "./pages/ProfileAddresses";
import MyOrders from "./pages/MyOrders";
import OrderDetails from "./pages/OrderDetails";
import Wishlist from "./pages/Wishlist";
import DriverDashboard from "./pages/DriverDashboard";

function RedirectOccasionToExotic() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/exotic/${slug}` : "/exotic"} replace />;
}

function PublicLayout() {
  return (
    <>
      <Navbar />
      <div className="pb-19 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Home />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/category/:slug" element={<CategoriesPage />} />
          <Route path="/exotic" element={<Occasion />} />
          <Route path="/exotic/:slug" element={<Occasion />} />
          <Route path="/organic" element={<NewArrivals />} />
          <Route path="/gift-boxes" element={<About />} />
          <Route path="/blog" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/profile/addresses" element={<ProfileAddresses />} />
          <Route path="/profile/orders" element={<MyOrders />} />
          <Route path="/profile/wishlist" element={<Wishlist />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/driver" element={<DriverProtectedRoute><DriverDashboard /></DriverProtectedRoute>} />
          <Route path="/search" element={<Search />} />
          {/* Redirect old paths to new (name-matched) paths */}
          <Route path="/occasion" element={<Navigate to="/exotic" replace />} />
          <Route path="/occasion/:slug" element={<RedirectOccasionToExotic />} />
          <Route path="/new" element={<Navigate to="/organic" replace />} />
          <Route path="/about" element={<Navigate to="/gift-boxes" replace />} />
          <Route path="/contact" element={<Navigate to="/blog" replace />} />
        </Routes>
      </div>
      <Footer />
      <div className="h-19 md:hidden" aria-hidden />
      <BottomMenuBar />
      {/* <ChatBot /> */}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <UserAuthProvider>
          <WishlistProvider>
          <RecentlyViewedProvider>
          <CartProvider>
          <BrowserRouter>
            <ScrollToTop />
            <ToastViewport />
            <WhatsAppFloatingButton />
            <Routes>
              {/* Admin: login has no layout; all other admin routes share sidebar + header via AdminLayout */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="orders/:id" element={<AdminOrderDetailPage />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="inventory" element={<AdminInventoryPage />} />
                <Route path="reviews" element={<AdminReviewsPage />} />
                <Route path="drivers" element={<AdminDriversPage />} />
              </Route>

              {/* Public Routes */}
              <Route path="/*" element={<PublicLayout />} />
            </Routes>
          </BrowserRouter>
          </CartProvider>
          </RecentlyViewedProvider>
          </WishlistProvider>
        </UserAuthProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
