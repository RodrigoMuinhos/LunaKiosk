"use client";

import { useEffect, useState } from 'react';
import { RotateCw, Film, Link } from 'lucide-react';
import { Button } from '../Button';
import { API_BASE_URL } from '../../lib/apiConfig';

type ApiResponse = {
  success: boolean;
  status: number;
  error?: string;
  warning?: string;
  rawText?: string;
  [key: string]: any;
};

interface ActiveVideoItem {
  id: string;
  filename: string;
  title?: string;
  displayOrder: number;
  filePath?: string;
}

const inputClass =
  'w-full rounded-2xl border border-[#E5D9CE] bg-white px-4 py-3 text-sm text-[#4F3F2E] placeholder:text-[#B09985] focus:outline-none focus:ring-2 focus:ring-[#D3A67F]/40 focus:border-[#D3A67F]';

const LOCAL_LIMIT = 15;

function resolveMessage(payload: any): string {
  if (!payload) return 'Falha desconhecida.';
  if (typeof payload === 'string') return payload;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload.rawText === 'string' && payload.rawText.trim()) return payload.rawText;
  return 'Falha desconhecida.';
}

export function VideosPanel() {
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(3);
  const [playlistUrl, setPlaylistUrl] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewWarning, setPreviewWarning] = useState<string>('');
  const [previewVideos, setPreviewVideos] = useState<ActiveVideoItem[]>([]);

  const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('lv_token') || '';
  };

  const getLocalApiUrl = (p: string) => {
    if (typeof window === 'undefined') return p;
    return `${window.location.origin}${p}`;
  };

  const apiRequest = async (method: string, endpoint: string, body?: any): Promise<ApiResponse> => {
    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const targetUrl = /^https?:\/\//i.test(endpoint) ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(targetUrl, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const contentType = response.headers.get('content-type') || '';
      let parsedData: any = null;
      let rawText = '';

      if (contentType.includes('application/json')) {
        try {
          parsedData = await response.json();
        } catch {
          parsedData = null;
        }
      }

      if (parsedData === null) {
        try {
          rawText = await response.text();
        } catch {
          rawText = '';
        }
      }

      const payload = parsedData && typeof parsedData === 'object' ? parsedData : {};

      return {
        success: response.ok,
        status: response.status,
        ...payload,
        rawText,
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  };

  const loadPreview = async () => {
    setLoadingPreview(true);
    setPreviewWarning('');
    try {
      const response = await apiRequest('GET', getLocalApiUrl('/api/videos/active'));
      if (response.success) {
        setPreviewWarning(typeof response.warning === 'string' ? response.warning : '');
        const list = Array.isArray(response.videos) ? response.videos : [];
        const mapped: ActiveVideoItem[] = list
          .map((v: any, idx: number) => ({
            id: String(v.id || `item:${idx}`),
            filename: String(v.filename || ''),
            title: typeof v.title === 'string' ? v.title : '',
            displayOrder: Number(v.displayOrder || idx + 1),
            filePath: typeof v.filePath === 'string' ? v.filePath : '',
          }))
          .filter((v) => v.id && (v.filename || v.title));
        setPreviewVideos(mapped);
      } else {
        setPreviewWarning(resolveMessage(response));
        setPreviewVideos([]);
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await apiRequest('GET', getLocalApiUrl('/api/videos/settings'));
      if (response.success && response.settings) {
        setPlaylistUrl(String(response.settings.playlistUrl || ''));
        const mins = Number.parseInt(String(response.settings.inactivityMinutes ?? 3), 10);
        const clamped = Number.isFinite(mins) ? Math.max(1, Math.min(5, mins)) : 3;
        setInactivityTimeout(clamped);
      }
    } catch (error) {
      console.warn('Falha ao carregar settings de vídeo', error);
    }
  };

  useEffect(() => {
    void loadSettings();
    void loadPreview();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await apiRequest('PUT', getLocalApiUrl('/api/videos/settings'), {
        playlistUrl,
        inactivityMinutes: inactivityTimeout,
      });

      if (response.success) {
        const warning = typeof response.warning === 'string' ? response.warning : '';
        window.alert(warning ? `Configurações salvas.\n\nAviso: ${warning}` : 'Configurações salvas.');
        await loadSettings();
        await loadPreview();
      } else {
        window.alert(`Erro ao salvar configurações: ${resolveMessage(response)}`);
      }
    } catch (error) {
      window.alert(`Erro ao salvar configurações: ${(error as Error)?.message || 'Desconhecido'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const normalizeCount = (count: number) => Math.max(0, Math.min(LOCAL_LIMIT, count));

  return (
    <div className="space-y-6 text-[#4F3F2E]">
      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/90 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A580]">Biblioteca</p>
            <h2 className="text-3xl font-semibold text-[#8C7155] flex items-center gap-2">
              <Film size={28} className="text-[#D3A67F]" />
              Vídeos (Playlist)
            </h2>
            <p className="text-sm text-[#7B6A5A]">
              Único modo suportado agora: playlist pública (Cloudflare Worker + R2) para tocar em loop.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-[#F7EFE6] px-4 py-2 text-sm text-[#7B6A5A]">
              <span className="text-xl font-semibold text-[#8C7155]">{normalizeCount(previewVideos.length)}</span>
              <span className="text-[#B09985]"> / {LOCAL_LIMIT} ativos</span>
            </div>
            <Button
              onClick={loadPreview}
              disabled={loadingPreview}
              variant="secondary"
              className="flex items-center justify-center rounded-full border border-[#CFB6A1] bg-white px-3 py-3 text-[#8C7155] hover:bg-[#F8F1EA]"
              size="sm"
              title="Atualizar prévia"
            >
              <RotateCw className={`h-4 w-4 ${loadingPreview ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/95 px-6 py-6 shadow-lg">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A580]">Configuração</p>
            <h3 className="text-2xl font-semibold text-[#8C7155]">URL da playlist</h3>
            <p className="text-sm text-[#7B6A5A]">
              Cole a URL do seu Worker <strong>/playlist.json</strong>.
            </p>
          </div>
          <div className="text-xs text-[#A38C77]">Recomendado para AppWeb/Vercel (sem custo de tráfego na Railway).</div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[#E9DAD1] bg-[#FFFCF8] p-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#7B6A5A] flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-[#F0E2D3] p-2 text-[#A27955]">
                <Link size={16} />
              </span>
              URL da playlist (JSON)
            </label>
            <input
              type="text"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://SEUWORKER.workers.dev/playlist.json"
              className={inputClass}
            />
            <p className="text-xs text-[#B09985]">
              Exemplo: <strong>https://red-rice-cfdd.rodrigomuinhostattooist.workers.dev/playlist.json</strong>
            </p>
          </div>

          <div className="mt-5 space-y-2">
            <label className="text-sm font-semibold text-[#7B6A5A]">Tempo de inatividade (minutos)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={5}
                value={inactivityTimeout}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  const safe = Number.isFinite(val) ? val : 1;
                  setInactivityTimeout(Math.max(1, Math.min(5, safe)));
                }}
                className={inputClass}
              />
              <span className="text-xs text-[#A38C77] whitespace-nowrap">Entre 1 e 5 minutos</span>
            </div>
            <p className="text-xs text-[#B09985]">Tempo sem interação antes de voltar ao carrossel de vídeos</p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={saveSettings}
              disabled={savingSettings}
              className="flex-1 rounded-2xl bg-[#8C7155] text-white hover:bg-[#7C6248]"
            >
              {savingSettings ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/95 px-6 py-6 shadow-lg">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A580]">Prévia</p>
            <h3 className="text-2xl font-semibold text-[#8C7155]">Vídeos da playlist</h3>
            <p className="text-sm text-[#7B6A5A]">Lista carregada do Worker e limitada a {LOCAL_LIMIT} itens.</p>
          </div>
          <div className="text-xs text-[#A38C77]">Clique em “atualizar” para recarregar.</div>
        </div>

        {previewWarning ? (
          <div className="mt-4 rounded-2xl border border-[#FFF4D6] bg-[#FFF9EA] px-4 py-3 text-sm text-[#8A6118]">
            {previewWarning}
          </div>
        ) : null}

        {loadingPreview ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[#E5D8CC] bg-[#FFFCF8] py-10 text-center text-[#7B6A5A]">
            Carregando playlist...
          </div>
        ) : previewVideos.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[#E5D8CC] bg-[#FFFCF8] py-10 text-center text-[#7B6A5A]">
            Nenhum vídeo na playlist (ou a URL ainda não foi configurada).
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {previewVideos.slice(0, LOCAL_LIMIT).map((video) => (
              <div
                key={video.id}
                className="rounded-[22px] border border-[#EFE2D7] bg-[#FFFCF8] px-5 py-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.25em] text-[#BA9C82]">Ordem {video.displayOrder}</div>
                    <div className="truncate text-base font-semibold text-[#4F3F2E]">
                      {video.title || video.filename}
                    </div>
                    {video.filename ? <div className="truncate text-xs text-[#7B6A5A]">{video.filename}</div> : null}
                  </div>
                  {video.filePath ? (
                    <a
                      href={video.filePath}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-full border border-[#CFB6A1] bg-white px-4 py-2 text-sm font-semibold text-[#8C7155] hover:bg-[#F8F1EA]"
                    >
                      Abrir
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nova seção: Adicionar vídeos manualmente */}
      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/90 px-6 py-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-2xl font-semibold text-[#8C7155] mb-2">➕ Adicionar Vídeos</h3>
          <p className="text-sm text-[#7B6A5A]">
            Cole URLs diretas do Gumlet, YouTube, Vimeo ou qualquer fonte de vídeo
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4F3F2E] mb-2">
              URL do Vídeo
            </label>
            <input
              type="text"
              placeholder="https://play.gumlet.io/embed/6768cde5..."
              className={inputClass}
              onBlur={(e) => {
                const urls = e.target.value.trim().split('\n').filter(Boolean);
                if (urls.length > 0) {
                  const playlistJson = {
                    videos: urls.map((url, i) => ({
                      id: `video-${Date.now()}-${i}`,
                      url: url,
                      title: `Vídeo ${i + 1}`,
                      sizeBytes: 0
                    }))
                  };
                  const jsonUrl = URL.createObjectURL(
                    new Blob([JSON.stringify(playlistJson)], { type: 'application/json' })
                  );
                  setPlaylistUrl(jsonUrl);
                  window.alert(`✅ ${urls.length} vídeo(s) adicionado(s)!\n\nClique em "Salvar configurações" para aplicar.`);
                }
              }}
            />
            <p className="text-xs text-[#A38C77] mt-1">
              💡 Dica: Cole várias URLs (uma por linha) de uma vez
            </p>
          </div>

          <div className="rounded-[20px] border border-[#E5D9CE] bg-[#FFFCF8] p-4">
            <h4 className="font-semibold text-[#8C7155] mb-2">📋 Exemplos de URLs:</h4>
            <ul className="text-xs text-[#7B6A5A] space-y-1">
              <li>• <strong>Gumlet:</strong> https://play.gumlet.io/embed/6768cde5...</li>
              <li>• <strong>Gumlet direto:</strong> https://video.gumlet.io/abc123/main.mp4</li>
              <li>• <strong>R2/Cloudflare:</strong> https://pub-xxx.r2.dev/video.mp4</li>
              <li>• <strong>YouTube:</strong> https://www.youtube.com/embed/VIDEO_ID</li>
              <li>• <strong>Qualquer MP4:</strong> https://exemplo.com/video.mp4</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
