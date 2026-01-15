import { useEffect, useRef, useState } from 'react';
import {
  RotateCw,
  UploadCloud,
  Film,
  Folder,
  HardDrive,
  CalendarDays,
  Hash,
  CheckCircle2,
  PencilLine,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '../Button';
import { API_BASE_URL } from '../../lib/apiConfig';

interface VideoItem {
  id: string;
  filename: string;
  title?: string;
  description?: string;
  displayOrder: number;
  fileSize: number;
  isActive: boolean;
  status: 'PENDING' | 'PROCESSING' | 'ACTIVE' | 'ARCHIVED' | 'ERROR';
  createdAt: string;
  filePath?: string;
}

const STATUS_COLORS: Record<VideoItem['status'], string> = {
  ACTIVE: 'bg-[#D9F7EC] text-[#165D3D]',
  PENDING: 'bg-[#FFF4D6] text-[#8A6118]',
  PROCESSING: 'bg-[#E6EDFE] text-[#2F4B9A]',
  ARCHIVED: 'bg-[#F7F3F0] text-[#6B5543]',
  ERROR: 'bg-[#FFE3E3] text-[#933535]',
};

const inputClass =
  'w-full rounded-2xl border border-[#E5D9CE] bg-white px-4 py-3 text-sm text-[#4F3F2E] placeholder:text-[#B09985] focus:outline-none focus:ring-2 focus:ring-[#D3A67F]/40 focus:border-[#D3A67F]';

const LOCAL_LIMIT = 15;

export function VideosPanel() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState({ title: '', description: '' });
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(3);
  const [videoSource, setVideoSource] = useState<'uploads' | 'folder'>('uploads');
  const [folderPath, setFolderPath] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAuthToken = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('lv_token') || '';
  };

  const getLocalApiUrl = (path: string) => {
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  };

  const apiRequest = async (method: string, endpoint: string, body?: BodyInit) => {
    const token = getAuthToken();
    const headers: HeadersInit = {};

    if (!(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    };

    const targetUrl = /^https?:\/\//i.test(endpoint) ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(targetUrl, options);
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

  const loadVideos = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('GET', getLocalApiUrl('/api/videos'));
      if (response.success) {
        const list = Array.isArray(response.videos) ? response.videos : [];
        const ordered = [...list].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        setVideos(ordered);
      } else {
        console.error('Falha ao carregar videos:', resolveMessage(response));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await apiRequest('GET', getLocalApiUrl('/api/videos/settings'));
      if (response.success && response.settings) {
        const src = response.settings.source === 'folder' ? 'folder' : 'uploads';
        setVideoSource(src);
        setFolderPath(String(response.settings.folderPath || ''));

        const mins = Number.parseInt(String(response.settings.inactivityMinutes ?? 3), 10);
        const clamped = Number.isFinite(mins) ? Math.max(1, Math.min(5, mins)) : 3;
        setInactivityTimeout(clamped);
      }
    } catch (error) {
      console.warn('Falha ao carregar settings de vídeo', error);
    }
  };

  useEffect(() => {
    loadSettings();
    loadVideos();
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await apiRequest('PUT', getLocalApiUrl('/api/videos/settings'), {
        source: videoSource,
        folderPath: folderPath,
        inactivityMinutes: inactivityTimeout,
      });

      if (response.success) {
        window.alert('Configurações salvas.');
        loadSettings();
        loadVideos();
      } else {
        window.alert(`Erro ao salvar configurações: ${resolveMessage(response)}`);
      }
    } catch (error) {
      window.alert(`Erro ao salvar configurações: ${(error as Error)?.message || 'Desconhecido'}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const applyFileSelection = (file: File) => {
    setSelectedFile(file);
    setUploadMeta((previous) => ({
      title: previous.title || file.name.replace(/\.[^.]+$/, ''),
      description: previous.description,
    }));
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadMeta({ title: '', description: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      applyFileSelection(file);
    }
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (videoSource === 'folder') {
      window.alert('Upload desabilitado: o Totem está usando vídeos de uma pasta local.');
      return;
    }
    if (!selectedFile) {
      window.alert('Selecione um arquivo de video.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadMeta.title || selectedFile.name);
      formData.append('description', uploadMeta.description || '');

      const response = await apiRequest('POST', getLocalApiUrl('/api/videos/upload'), formData);

      if (response.success) {
        window.alert('Video enviado com sucesso.');
        clearSelectedFile();
        loadVideos();
      } else {
        window.alert(`Erro ao enviar: ${resolveMessage(response)}`);
      }
    } catch (error) {
      window.alert(`Erro ao enviar video: ${(error as Error)?.message || 'Desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    const confirmed = window.confirm('Deseja remover este video?');
    if (!confirmed) return;

    try {
      const response = await apiRequest('DELETE', getLocalApiUrl(`/api/videos/${videoId}`));
      if (response.success) {
        window.alert('Video removido.');
        loadVideos();
      } else {
        window.alert(`Erro ao remover: ${resolveMessage(response)}`);
      }
    } catch (error) {
      window.alert(`Erro ao remover video: ${(error as Error)?.message || 'Desconhecido'}`);
    }
  };

  const startEditingVideo = (video: VideoItem) => {
    setEditingVideo({ ...video });
  };

  const handleUpdateVideo = async () => {
    if (!editingVideo) return;

    try {
      const response = await apiRequest('PUT', getLocalApiUrl(`/api/videos/${editingVideo.id}`), {
        title: editingVideo.title || '',
        description: editingVideo.description || '',
        displayOrder: editingVideo.displayOrder,
        isActive: editingVideo.isActive,
      });

      if (response.success) {
        window.alert('Video atualizado.');
        setEditingVideo(null);
        loadVideos();
      } else {
        window.alert(`Erro ao atualizar: ${resolveMessage(response)}`);
      }
    } catch (error) {
      window.alert(`Erro ao atualizar video: ${(error as Error)?.message || 'Desconhecido'}`);
    }
  };

  const handleToggleActive = async (video: VideoItem) => {
    try {
      const response = await apiRequest('PUT', getLocalApiUrl(`/api/videos/${video.id}`), {
        title: video.title || '',
        description: video.description || '',
        displayOrder: video.displayOrder,
        isActive: !video.isActive,
      });

      if (response.success) {
        loadVideos();
      } else {
        window.alert(`Erro ao alternar status: ${resolveMessage(response)}`);
      }
    } catch (error) {
      window.alert(`Erro ao alternar status: ${(error as Error)?.message || 'Desconhecido'}`);
    }
  };

  const handleDrag = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      applyFileSelection(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const order = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const value = bytes / Math.pow(k, order);
    return `${value.toFixed(order === 0 ? 0 : 1)} ${sizes[order]}`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('pt-BR');
  };

  const statusBadge = (status: VideoItem['status']) =>
    `inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`;

  const renderMetaRow = (Icon: typeof Folder, label: string, value: string | number | undefined) => (
    <div className="flex items-center gap-2 text-sm text-[#6C5A49]">
      <Icon size={16} className="text-[#D3A67F]" />
      <div className="flex flex-col leading-tight">
        <span className="text-xs uppercase tracking-[0.2em] text-[#BA9C82]">{label}</span>
        <span className="font-semibold text-[#4F3F2E]">{value || '--'}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 text-[#4F3F2E]">
      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/90 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A580]">Biblioteca</p>
            <h2 className="text-3xl font-semibold text-[#8C7155] flex items-center gap-2">
              <Film size={28} className="text-[#D3A67F]" />
              Videos
            </h2>
            <p className="text-sm text-[#7B6A5A]">Gerencie o carrossel de ate 15 videos ativos no totem.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-[#F7EFE6] px-4 py-2 text-sm text-[#7B6A5A]">
              <span className="text-xl font-semibold text-[#8C7155]">{videos.length}</span>
              <span className="text-[#B09985]"> / {LOCAL_LIMIT} ativos</span>
            </div>
            <Button
              onClick={loadVideos}
              disabled={loading}
              variant="secondary"
              className="flex items-center justify-center rounded-full border border-[#CFB6A1] bg-white px-3 py-3 text-[#8C7155] hover:bg-[#F8F1EA]"
              size="sm"
              title="Atualizar vídeos"
            >
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/95 px-6 py-6 shadow-lg">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A580]">Envio</p>
            <h3 className="text-2xl font-semibold text-[#8C7155]">Novo video</h3>
            <p className="text-sm text-[#7B6A5A]">Formatos aceitos: MP4, MOV, AVI, WEBM, MKV (ate 250MB).</p>
          </div>
          <div className="text-xs text-[#A38C77]">Arraste o arquivo ou selecione pelo explorador.</div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[#E9DAD1] bg-[#FFFCF8] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#7B6A5A]">Fonte dos vídeos do descanso</p>
              <p className="text-xs text-[#A38C77]">
                No LunaKiosk local você pode apontar para uma pasta do PC. Em hospedagens (ex: Vercel) isso não funciona.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVideoSource('uploads')}
                className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
                  videoSource === 'uploads'
                    ? 'bg-[#D3A67F] text-white border-[#D3A67F]'
                    : 'bg-white text-[#8C7155] border-[#CFB6A1] hover:bg-[#F8F1EA]'
                }`}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setVideoSource('folder')}
                className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
                  videoSource === 'folder'
                    ? 'bg-[#D3A67F] text-white border-[#D3A67F]'
                    : 'bg-white text-[#8C7155] border-[#CFB6A1] hover:bg-[#F8F1EA]'
                }`}
              >
                Pasta local
              </button>
            </div>
          </div>

          {videoSource === 'folder' && (
            <div className="mt-4 space-y-2">
              <label className="text-sm font-semibold text-[#7B6A5A]">Caminho da pasta (ex: C:\\Videos\\Luna)</label>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="C:\\LunaKiosk\\videos"
                className={inputClass}
              />
              <p className="text-xs text-[#B09985]">
                O totem vai listar automaticamente os arquivos de vídeo dessa pasta (MP4/MOV/AVI/WEBM/MKV).
              </p>
            </div>
          )}

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

        <form onSubmit={handleUpload} className="mt-6 space-y-5">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`rounded-[28px] border-2 border-dashed p-6 text-center transition-all ${
              dragActive
                ? 'border-[#D3A67F] bg-[#F4E8DC]'
                : 'border-[#E5D8CC] bg-[#FFFCF8] hover:border-[#D3A67F]'
            }`}
          >
            <input
              ref={fileInputRef}
              id="video-upload-input"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <label htmlFor="video-upload-input" className="flex flex-col items-center gap-3 cursor-pointer">
              <span className="rounded-full bg-[#F0E2D3] p-5 text-[#A27955]">
                <UploadCloud size={32} />
              </span>
              <span className="text-lg font-semibold text-[#8C7155]">Clique ou solte o video aqui</span>
              <span className="text-sm text-[#A38C77]">Garantimos o mesmo visual minimalista do sistema.</span>
            </label>
          </div>

          {selectedFile && (
            <div className="rounded-2xl border border-[#C7E7C1] bg-[#F2FBEE] px-4 py-3 text-left">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#235336]">{selectedFile.name}</p>
                  <p className="text-xs text-[#3E6B4F]">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="inline-flex items-center gap-2 rounded-full border border-[#7ABF92] px-3 py-1 text-xs font-semibold text-[#1F6B44] hover:bg-[#E1F6EA]"
                >
                  <XCircle size={14} />
                  Trocar arquivo
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#7B6A5A]">Titulo (opcional)</label>
              <input
                type="text"
                value={uploadMeta.title}
                onChange={(event) => setUploadMeta({ ...uploadMeta, title: event.target.value })}
                placeholder="Ex: Video institucional"
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#7B6A5A]">Descricao (opcional)</label>
              <input
                type="text"
                value={uploadMeta.description}
                onChange={(event) => setUploadMeta({ ...uploadMeta, description: event.target.value })}
                placeholder="Ex: Campanha 2025"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#7B6A5A]">Tempo de inatividade (minutos)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="5"
                value={inactivityTimeout}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setInactivityTimeout(Math.max(1, Math.min(5, val)));
                }}
                className={inputClass}
              />
              <span className="text-xs text-[#A38C77] whitespace-nowrap">Entre 1 e 5 minutos</span>
            </div>
            <p className="text-xs text-[#B09985]">Tempo sem interação antes de voltar ao carrossel de vídeos</p>
          </div>

          <Button
            type="submit"
            disabled={videoSource === 'folder' || !selectedFile || uploading}
            className="w-full rounded-2xl bg-[#D3A67F] text-white text-lg font-semibold hover:bg-[#C38F64] disabled:opacity-50"
          >
            {videoSource === 'folder'
              ? 'Upload desabilitado (pasta local ativa)'
              : uploading
                ? 'Enviando...'
                : 'Adicionar a galeria'}
          </Button>
        </form>
      </section>

      <section className="rounded-[32px] border border-[#E9DAD1] bg-white/95 px-6 py-6 shadow-lg">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A580]">Galeria</p>
            <h3 className="text-2xl font-semibold text-[#8C7155]">Videos cadastrados</h3>
            <p className="text-sm text-[#7B6A5A]">Mantenha apenas os videos aprovados e ativos no totem.</p>
          </div>
          {!loading && (
            <div className="text-xs text-[#A38C77]">
              {videos.length > 0 ? 'Clique em "Editar" para ajustar titulo, descricao e ordem.' : 'Nenhum video cadastrado.'}
            </div>
          )}
        </div>

        {loading ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[#E5D8CC] bg-[#FFFCF8] py-10 text-center text-[#7B6A5A]">
            Carregando videos...
          </div>
        ) : videos.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[#E5D8CC] bg-[#FFFCF8] py-10 text-center text-[#7B6A5A]">
            Nenhum video enviado. Use o formulario acima para iniciar.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {videos.map((video) => (
              <div
                key={video.id}
                className="rounded-[28px] border border-[#EFE2D7] bg-[#FFFCF8] px-5 py-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#F4E2D3] px-3 py-1 text-xs font-semibold text-[#8C7155]">
                        <Hash size={14} />
                        Ordem {video.displayOrder}
                      </span>
                      <span className={statusBadge(video.status)}>{video.status}</span>
                    </div>
                    <h4 className="text-lg font-semibold text-[#4F3F2E]">{video.title || video.filename}</h4>
                    {video.description && <p className="text-sm text-[#7B6A5A]">{video.description}</p>}
                    <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-6">
                      {renderMetaRow(Folder, 'Arquivo', video.filename)}
                      {renderMetaRow(HardDrive, 'Tamanho', formatFileSize(video.fileSize))}
                      {renderMetaRow(CalendarDays, 'Criado em', formatDate(video.createdAt))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(video)}
                      className={`inline-flex items-center justify-center rounded-2xl px-3 py-3 transition-all ${
                        video.isActive
                          ? 'bg-[#E3F3E8] text-[#1B6B4B] hover:bg-[#D0EBD9]'
                          : 'bg-[#F3F3F3] text-[#7B6A5A] hover:bg-[#E8E8E8]'
                      }`}
                      title={video.isActive ? 'Desativar no totem' : 'Ativar no totem'}
                    >
                      {video.isActive ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingVideo(video)}
                      className="inline-flex items-center justify-center rounded-2xl border border-[#D3A67F] px-3 py-3 text-[#8C7155] hover:bg-[#F6EBE0]"
                      title="Editar vídeo"
                    >
                      <PencilLine size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(video.id)}
                      className="inline-flex items-center justify-center rounded-2xl border border-[#F3C9C9] bg-[#FFF5F5] px-3 py-3 text-[#A24040] hover:bg-[#FFE9E9]"
                      title="Excluir vídeo"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {editingVideo?.id === video.id && (
                  <div className="mt-5 rounded-2xl border border-[#E8D9CA] bg-white p-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-[#7B6A5A]">Titulo</label>
                        <input
                          type="text"
                          value={editingVideo.title || ''}
                          onChange={(event) =>
                            setEditingVideo({ ...editingVideo, title: event.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-[#7B6A5A]">Ordem</label>
                        <input
                          type="number"
                          min={1}
                          value={editingVideo.displayOrder}
                          onChange={(event) =>
                            setEditingVideo({
                              ...editingVideo,
                              displayOrder: Number(event.target.value) || 1,
                            })
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[#7B6A5A]">Descricao</label>
                      <textarea
                        value={editingVideo.description || ''}
                        onChange={(event) =>
                          setEditingVideo({ ...editingVideo, description: event.target.value })
                        }
                        rows={3}
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[#7B6A5A]">Status no carrossel</label>
                      <button
                        type="button"
                        onClick={() => setEditingVideo({ ...editingVideo, isActive: !editingVideo.isActive })}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold transition-all ${
                          editingVideo.isActive
                            ? 'bg-[#E3F3E8] text-[#1B6B4B] border border-[#B8E3C8]'
                            : 'bg-[#F3F3F3] text-[#7B6A5A] border border-[#D9D9D9]'
                        }`}
                      >
                        {editingVideo.isActive ? (
                          <>
                            <CheckCircle2 size={18} />
                            Ativo no totem
                          </>
                        ) : (
                          <>
                            <XCircle size={18} />
                            Inativo
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        onClick={handleUpdateVideo}
                        className="flex-1 rounded-2xl bg-[#8C7155] text-white hover:bg-[#7C6248]"
                      >
                        Salvar alteracoes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingVideo(null)}
                        className="flex-1 rounded-2xl bg-white text-[#8C7155]"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function resolveMessage(payload: Record<string, any> | null | undefined, fallback = 'Sem detalhes') {
  if (!payload) return fallback;
  if (payload.error) return payload.error;
  if (payload.message) return payload.message;
  if (payload.rawText) return payload.rawText;
  if (typeof payload.status === 'number') return `Status ${payload.status}`;
  return fallback;
}
