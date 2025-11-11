import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '../App';
import { ScanBarcode, Users, Building2 } from 'lucide-react';

export default function LoginPage({ setUser }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', response.data.access_token);
        setUser(response.data.user);
        toast.success('Erfolgreich angemeldet!');
        navigate(response.data.user.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        const response = await api.post('/auth/register', {
          email,
          password,
          company_id: companyId,
          role: 'user'
        });
        localStorage.setItem('token', response.data.access_token);
        setUser(response.data.user);
        toast.success('Erfolgreich registriert!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ScanBarcode className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Mitarbeiter-Notizen</h1>
          <p className="text-slate-600">Mobile-First Notizen-Management</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>{isLogin ? 'Anmelden' : 'Registrieren'}</CardTitle>
            <CardDescription>
              {isLogin ? 'Melden Sie sich mit Ihren Zugangsdaten an' : 'Erstellen Sie ein neues Konto'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre.email@firma.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="password-input"
                />
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="companyId">Firmen-ID</Label>
                  <Input
                    id="companyId"
                    type="text"
                    placeholder="Firmen-ID"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    required
                    data-testid="company-id-input"
                  />
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                disabled={loading}
                data-testid="submit-button"
              >
                {loading ? 'Wird verarbeitet...' : (isLogin ? 'Anmelden' : 'Registrieren')}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                data-testid="toggle-auth-mode"
              >
                {isLogin ? 'Noch kein Konto? Registrieren' : 'Bereits registriert? Anmelden'}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <ScanBarcode className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-xs text-slate-600">Barcode-Scan</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-xs text-slate-600">Mitarbeiter</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-xs text-slate-600">Firmen</p>
          </div>
        </div>
      </div>
    </div>
  );
}
