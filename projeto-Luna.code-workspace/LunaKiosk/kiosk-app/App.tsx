import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getItem, setItem } from './src/storage/tokenStore';
import { lunaCoreLogin } from './src/api/lunaCore';
import { searchAppointments, createPixPayment, getPixStatus, markAppointmentConfirmed, type Appointment } from './src/api/totemApi';

type Screen = 'config' | 'login' | 'search' | 'pix' | 'done';

export default function App() {
  const [screen, setScreen] = useState<Screen>('config');

  // Defaults alinhados com as tasks do workspace (LunaCore 18080 / TotemAPI 18081)
  // Ainda é configurável na tela de Configuração.
  const [coreBaseUrl, setCoreBaseUrl] = useState('http://localhost:18080');
  const [totemBaseUrl, setTotemBaseUrl] = useState('http://localhost:18081');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [jwt, setJwt] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [pixStatus, setPixStatus] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const savedCore = await getItem('CORE_BASE_URL');
      const savedTotem = await getItem('TOTEM_BASE_URL');
      const savedJwt = await getItem('JWT');

      if (savedCore) setCoreBaseUrl(savedCore);
      if (savedTotem) setTotemBaseUrl(savedTotem);
      if (savedJwt) {
        setJwt(savedJwt);
        setScreen('search');
      }
    })();
  }, []);

  const authHeader = useMemo(() => (jwt ? `Bearer ${jwt}` : null), [jwt]);

  const saveConfig = async () => {
    await setItem('CORE_BASE_URL', coreBaseUrl);
    await setItem('TOTEM_BASE_URL', totemBaseUrl);
    setScreen('login');
  };

  const doLogin = async () => {
    setBusy(true);
    try {
      const res = await lunaCoreLogin(coreBaseUrl, email, password);
      if (!res.token) throw new Error('Login sem token');
      setJwt(res.token);
      await setItem('JWT', res.token);
      setScreen('search');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha no login');
    } finally {
      setBusy(false);
    }
  };

  const doSearch = async () => {
    if (!authHeader) return;
    setBusy(true);
    try {
      const list = await searchAppointments(totemBaseUrl, authHeader, searchQuery);
      setAppointments(list);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha na busca');
    } finally {
      setBusy(false);
    }
  };

  const startPix = async (appointment: Appointment) => {
    if (!authHeader) return;
    setBusy(true);
    try {
      setSelected(appointment);
      const pix = await createPixPayment(totemBaseUrl, authHeader, appointment.id);
      setPixPaymentId(pix.paymentId);
      setPixQrBase64(pix.qrCodeImageBase64 ?? null);
      setPixCopyPaste(pix.qrCodeText ?? null);
      setPixStatus(pix.status ?? 'PENDING');
      setScreen('pix');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao gerar PIX');
    } finally {
      setBusy(false);
    }
  };

  // polling do status do PIX
  useEffect(() => {
    if (screen !== 'pix' || !pixPaymentId || !authHeader) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const s = await getPixStatus(totemBaseUrl, authHeader, pixPaymentId);
        if (cancelled) return;
        setPixStatus(s.status);

        const normalized = (s.status || '').toUpperCase();
        if (normalized === 'PAID') {
          if (selected?.id) {
            await markAppointmentConfirmed(totemBaseUrl, authHeader, selected.id);
          }
          setScreen('done');
        }
      } catch {
        // ignora falha temporária
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screen, pixPaymentId, authHeader, totemBaseUrl, selected]);

  const logout = async () => {
    await setItem('JWT', '');
    setJwt(null);
    setScreen('login');
  };

  if (screen === 'config') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>LunaKiosk</Text>
        <Text style={styles.subtitle}>Configuração</Text>

        <Text style={styles.label}>LunaCore URL</Text>
        <TextInput value={coreBaseUrl} onChangeText={setCoreBaseUrl} style={styles.input} autoCapitalize="none" />

        <Text style={styles.label}>TotemAPI URL</Text>
        <TextInput value={totemBaseUrl} onChangeText={setTotemBaseUrl} style={styles.input} autoCapitalize="none" />

        <Button title="Salvar" onPress={saveConfig} />
      </View>
    );
  }

  if (screen === 'login') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>LunaCore</Text>

        <TextInput placeholder="email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="senha" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />

        {busy ? <ActivityIndicator /> : <Button title="Entrar" onPress={doLogin} />}

        <View style={{ height: 12 }} />
        <Button title="Configuração" onPress={() => setScreen('config')} />
      </View>
    );
  }

  if (screen === 'search') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Buscar Consulta</Text>
        <Text style={styles.subtitle}>TotemAPI</Text>

        <TextInput placeholder="Nome (mín 2 letras)" value={searchQuery} onChangeText={setSearchQuery} style={styles.input} />
        {busy ? <ActivityIndicator /> : <Button title="Buscar" onPress={doSearch} />}

        <View style={{ height: 16 }} />

        <ScrollView style={{ width: '100%' }}>
          {appointments.map((a) => (
            <View key={a.id} style={styles.card}>
              <Text style={styles.cardTitle}>{a.patient} • {a.date} {a.time}</Text>
              <Text style={styles.cardText}>{a.doctor} • {a.specialty}</Text>
              <Text style={styles.cardText}>R$ {Number(a.amount ?? 0).toFixed(2)}</Text>
              <Button title="Gerar PIX" onPress={() => startPix(a)} />
            </View>
          ))}
        </ScrollView>

        <View style={{ height: 16 }} />
        <Button title="Sair" onPress={logout} />

        <View style={{ height: 12 }} />
        <Button title="Configuração" onPress={() => setScreen('config')} />
      </View>
    );
  }

  if (screen === 'pix') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pagamento PIX</Text>
        <Text style={styles.subtitle}>Status: {pixStatus ?? '...'}</Text>

        <Text style={styles.label}>PaymentId</Text>
        <Text style={styles.mono}>{pixPaymentId ?? '-'}</Text>

        <Text style={styles.label}>Copia e cola</Text>
        <Text style={styles.mono}>{pixCopyPaste ?? '-'}</Text>

        <Text style={styles.help}>QR Code base64 disponível (render no mobile/web pode variar; por enquanto mostramos o texto)</Text>

        <Button title="Voltar" onPress={() => setScreen('search')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Concluído</Text>
      <Text style={styles.subtitle}>Pagamento confirmado</Text>
      <Button title="Nova operação" onPress={() => {
        setAppointments([]);
        setSelected(null);
        setPixPaymentId(null);
        setPixQrBase64(null);
        setPixCopyPaste(null);
        setPixStatus(null);
        setScreen('search');
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 18 },
  label: { alignSelf: 'flex-start', fontSize: 12, color: '#666', marginTop: 12 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginTop: 8 },
  card: { width: '100%', borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardText: { color: '#444', marginTop: 2 },
  mono: { alignSelf: 'flex-start', fontFamily: 'monospace', fontSize: 12, color: '#111', marginTop: 4 },
  help: { marginTop: 12, fontSize: 12, color: '#666' }
});
