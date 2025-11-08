import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';

const Index = lazy(() => import('./pages/Index'));
const Auth = lazy(() => import('./pages/Auth'));
const VideoSection = lazy(() => import('./pages/VideoSection'));
const PhotoSection = lazy(() => import('./pages/PhotoSection'));
const Profile = lazy(() => import('./pages/Profile'));
const Messages = lazy(() => import('./components/Messages'));
const Tokens = lazy(() => import('./pages/Tokens'));
const LiveStreams = lazy(() => import('./pages/LiveStreams'));
const Settings = lazy(() => import('./pages/Settings'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }
  
  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Suspense fallback={
              <div className="flex justify-center items-center h-screen">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            }>
              <Routes>
                <Route path="/auth" element={
                  <PublicRoute>
                    <Auth />
                  </PublicRoute>
                } />
                <Route element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Index />} />
                  <Route path="/videos" element={<VideoSection />} />
                  <Route path="/photos" element={<PhotoSection />} />
                  <Route path="/streams" element={<LiveStreams />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/tokens" element={<Tokens />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/create-post" element={<CreatePost />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;