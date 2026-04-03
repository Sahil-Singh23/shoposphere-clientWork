import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { API } from '../api';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useUserAuth();
  const { mergeCart } = useCart();
  const { mergeWishlist } = useWishlist();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const error = searchParams.get('message');

        if (error) {
          console.error('OAuth error:', error);
          navigate('/', { replace: true });
          return;
        }

        const response = await fetch(`${API}/auth/me`, {
          credentials: 'include',
        });

        if (!response.ok) {
          console.error('Failed to fetch user data');
          navigate('/', { replace: true });
          return;
        }

        const data = await response.json();
        const user = data.user;

        const success = await loginWithToken(null, user);
        
        if (success) {
          // Merge cart for regular customers
          if (user.role === 'customer') {
            await mergeCart();
            await mergeWishlist();
          }
          
          // Redirect based on user role
          if (user.role === 'admin') {
            window.location.href = '/admin/dashboard';
          } else if (user.role === 'driver') {
            navigate('/driver', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        } else {
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithToken, mergeCart, mergeWishlist]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--page-auth-bg)" }}
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p style={{ color: "var(--foreground)" }}>Completing authentication...</p>
      </div>
    </div>
  );
}