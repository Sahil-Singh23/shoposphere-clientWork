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

        // Read token and user data from query parameters (set by backend OAuth callback)
        const token = searchParams.get('token');
        const userId = searchParams.get('userId');
        const role = searchParams.get('role');

        if (!token || !userId) {
          console.error('Missing token or userId from OAuth callback');
          navigate('/', { replace: true });
          return;
        }

        // Construct user object from query params
        const user = {
          id: parseInt(userId, 10),
          role: role || 'customer',
        };

        // Log in with the token and user data
        const success = await loginWithToken(token, user);
        
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