"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from '@/totem-system/components/Dashboard';
import { clearAuth, ensureFreshToken, normalizeRole, setAuth } from "@/lib/apiConfig";
import { Patients } from '@/totem-system/components/Patients';
import { Doctors } from '@/totem-system/components/Doctors';
import { Appointments } from '@/totem-system/components/Appointments';
import { Calendar } from '@/totem-system/components/Calendar';
import { Settings, UserRound, Video as VideoIcon, LogOut, RotateCw } from "lucide-react";
import { UserManagementDialog } from "@/totem-system/components/UserManagementDialog";
import { VideosPanel } from "@/components/pages/VideosPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UiRole = 'ADMINISTRACAO' | 'MEDICO' | 'RECEPCAO';

const ROLE_LABELS: Record<UiRole, string> = {
  ADMINISTRACAO: 'Administração',
  MEDICO: 'Médico',
  RECEPCAO: 'Recepção · Espaço 1',
};

export default function SystemPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<'dashboard' | 'patients' | 'doctors' | 'appointments' | 'calendar'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<UiRole>('RECEPCAO');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const configMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const refreshCallbackRef = useRef<(() => void) | null>(null);

  const handleReturnToTotem = () => {
    // No password required to return to the totem — simply navigate
    router.push('/');
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedUser = window.localStorage.getItem('user');
    const token = window.localStorage.getItem('lv_token');
    const role = normalizeRole(window.localStorage.getItem('lv_role'));
    const hasValidToken =
      !!token && token !== 'undefined' && token !== 'null' && token.split('.').length === 3;
    if (hasValidToken) {
      setAuth(token, role);
      ensureFreshToken();
    } else if (token) {
      // Token exists but is invalid (common after older login payload mismatches)
      clearAuth();
    }

    if (role === 'ADMINISTRACAO' || role === 'MEDICO' || role === 'RECEPCAO') {
      setUserRole(role);
    }
    if (!storedUser) {
      return;
    }

    try {
      const parsed = JSON.parse(storedUser);
      const parsedRole = normalizeRole(parsed?.role);
      if (parsedRole === 'ADMINISTRACAO' || parsedRole === 'MEDICO' || parsedRole === 'RECEPCAO') {
        setUserRole(parsedRole);
      }
    } catch (error) {
      console.warn('Falha ao interpretar usuário salvo', error);
    }
  }, []);

  useEffect(() => {
    if (userRole === 'RECEPCAO' && activeView === 'doctors') {
      setActiveView('patients');
    }
  }, [userRole, activeView]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (!isConfigMenuOpen) {
        return;
      }
      const target = event.target as Node;
      if (configMenuContainerRef.current && !configMenuContainerRef.current.contains(target)) {
        setIsConfigMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isConfigMenuOpen]);

  useEffect(() => {
    if (userRole !== 'ADMINISTRACAO') {
      setIsConfigMenuOpen(false);
      setIsVideoDialogOpen(false);
    }
  }, [userRole]);

  const toggleConfigMenu = () => {
    setIsConfigMenuOpen((prev) => !prev);
  };

  const handleOpenUserSettings = () => {
    setIsConfigMenuOpen(false);
    setIsUserDialogOpen(true);
  };

  const handleOpenVideoManager = () => {
    setIsConfigMenuOpen(false);
    setIsVideoDialogOpen(true);
  };

  const handleLogout = () => {
    setIsConfigMenuOpen(false);
    clearAuth();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    router.push('/');
  };

  const handleGlobalRefresh = () => {
    if (refreshCallbackRef.current) {
      refreshCallbackRef.current();
    }
  };

  // Close with Escape and lock body scroll when menu opens (mobile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };

    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKey);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);
  const roleDisplay = ROLE_LABELS[userRole];
  return (
    <div className="min-h-screen bg-gray-50">
    <div className="flex min-h-screen w-full overflow-hidden">

        {/* Sidebar - on small screens this becomes an overlay */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out bg-white border-r shadow-sm w-72 sm:static sm:translate-x-0 sm:inset-auto sm:z-auto ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
          }`}
          aria-hidden={!mobileMenuOpen && true}
        >
          <div className="px-6 py-8 border-b relative">
            <div className="text-xs uppercase tracking-wider text-gray-400">Luna Vita</div>
            <div className="mt-3 text-3xl font-serif leading-tight">Work<br/>Space</div>
            {/* Close button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="sm:hidden absolute top-3 right-3 inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Fechar menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 6L18 18M6 18L18 6" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <nav className="px-4 py-6 space-y-2">
            <button
              onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium ${
                activeView === 'dashboard' ? 'bg-[#F8F8F8] text-gray-900 border-l-4 border-[#D3A67F]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => { setActiveView('patients'); setMobileMenuOpen(false); }}
              className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium ${
                activeView === 'patients' ? 'bg-[#F8F8F8] text-gray-900 border-l-4 border-[#D3A67F]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Pacientes
            </button>

            {userRole !== 'RECEPCAO' && (
              <button
                onClick={() => { setActiveView('doctors'); setMobileMenuOpen(false); }}
                className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium ${
                  activeView === 'doctors' ? 'bg-[#F8F8F8] text-gray-900 border-l-4 border-[#D3A67F]' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Médicos
              </button>
            )}

            <button
              onClick={() => { setActiveView('appointments'); setMobileMenuOpen(false); }}
              className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium ${
                activeView === 'appointments' ? 'bg-[#F8F8F8] text-gray-900 border-l-4 border-[#D3A67F]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Consultas
            </button>

            <button
              onClick={() => { setActiveView('calendar'); setMobileMenuOpen(false); }}
              className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium ${
                activeView === 'calendar' ? 'bg-[#F8F8F8] text-gray-900 border-l-4 border-[#D3A67F]' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Calendário
            </button>
          </nav>

          <div className="px-6 py-4 border-t space-y-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleReturnToTotem}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-[#D3A67F] px-3 py-2 text-sm font-medium text-[#D3A67F] hover:bg-[#F9F6F2]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor" />
                </svg>
                Voltar ao Totem
              </button>
            </div>
            <div className="text-sm text-gray-700">
              <div className="text-xs text-gray-400">Conectado como</div>
              <div className="mt-1 font-medium">{ROLE_LABELS[userRole]}</div>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex flex-col gap-4 bg-white px-6 py-4 border-b shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 w-full min-w-0">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen((s) => !s)}
                className="sm:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-gray-700 hover:bg-gray-100"
                aria-label="Abrir menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6h18M3 12h18M3 18h18" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-800 truncate">Painel Administrativo</h1>
                <p className="text-sm text-gray-500 mt-1">Visão geral e operações</p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              {userRole === 'ADMINISTRACAO' && (
                <div className="relative flex justify-end sm:justify-start gap-2" ref={configMenuContainerRef}>
                  <button
                    type="button"
                    onClick={handleGlobalRefresh}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#D3A67F]/50 text-[#D3A67F] transition hover:bg-[#F6EFE7]"
                    aria-label="Atualizar página"
                    title="Atualizar"
                  >
                    <RotateCw size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleConfigMenu}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#D3A67F]/50 text-[#D3A67F] transition hover:bg-[#F6EFE7]"
                    aria-label="Configurações rápidas"
                    aria-haspopup="menu"
                    aria-expanded={isConfigMenuOpen}
                  >
                    <Settings size={20} />
                  </button>
                  {isConfigMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-3 w-64 rounded-[30px] border border-[#E8E2DA] bg-white px-4 py-5 shadow-2xl"
                    >
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#C4A07C]">
                        Configurações
                      </p>
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleOpenUserSettings}
                          className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[#F8F6F1]"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D3A67F]/40 bg-[#F9F6F2] text-[#D3A67F] transition group-hover:bg-[#F2E7DD]">
                            <UserRound size={18} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-[#4A4A4A]">Login</p>
                            <p className="text-xs text-[#4A4A4A]/60">Gerencie acessos e senhas</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenVideoManager}
                          className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-[#F8F6F1]"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D3A67F]/40 bg-[#F9F6F2] text-[#D3A67F] transition group-hover:bg-[#F2E7DD]">
                            <VideoIcon size={18} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-[#4A4A4A]">Vídeo</p>
                            <p className="text-xs text-[#4A4A4A]/60">Enviar e organizar mídia</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-red-50"
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition group-hover:bg-red-100">
                            <LogOut size={18} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-red-600">Logout</p>
                            <p className="text-xs text-red-500/80">Encerrar sessão</p>
                          </div>
                        </button>
                      </div>
                      <div className="absolute -bottom-1 right-6 h-4 w-4 rotate-45 border-b border-r border-[#E8E2DA] bg-white" aria-hidden />
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 min-w-0 overflow-y-auto px-4 pt-4 pb-20 sm:px-6 sm:py-6">
            {activeView === 'dashboard' && <Dashboard refreshCallbackRef={refreshCallbackRef} />}
            {activeView === 'patients' && <Patients refreshCallbackRef={refreshCallbackRef} />}
            {activeView === 'doctors' && userRole !== 'RECEPCAO' && <Doctors refreshCallbackRef={refreshCallbackRef} />}
            {activeView === 'appointments' && (
              <Appointments canControlTimers={userRole === 'MEDICO'} refreshCallbackRef={refreshCallbackRef} />
            )}
            {activeView === 'calendar' && <Calendar refreshCallbackRef={refreshCallbackRef} />}
          </main>
        </div>

        {/* Overlay behind mobile menu */}
        {/* overlay - fades in/out */}
        <div
          onClick={() => setMobileMenuOpen(false)}
          className={`fixed inset-0 z-40 sm:hidden transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-100 bg-black/30 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        />

        {userRole === 'ADMINISTRACAO' && (
          <UserManagementDialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen} />
        )}
        {userRole === 'ADMINISTRACAO' && (
          <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
            <DialogContent className="w-full max-w-5xl rounded-[32px] border border-[#E8E2DA] bg-[#F8F6F1] text-[#2F2F2F]">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-2xl font-semibold text-[#4A4A4A]">
                  Biblioteca de vídeos
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[78vh] overflow-y-auto pr-1">
                <VideosPanel />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}


