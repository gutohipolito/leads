'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Dispara o carregamento do vídeo apenas após a página estar disponível
    const timer = setTimeout(() => {
      setVideoSrc('/3141208-uhd_3840_2160_25fps.mp4');
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Iniciando tentativa de login para:', email);
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log('Resposta do Supabase recebida:', { data, error: authError });

      if (authError) throw authError;

      // Atualizar o último login no perfil do sistema e buscar os dados de perfil em paralelo
      const [updateResult, profileResult] = await Promise.all([
        supabase
          .from('system_users')
          .update({ last_login: new Date().toISOString() })
          .eq('email', email),
        supabase
          .from('system_users')
          .select('role, avatar_style, password_changed, client_id')
          .eq('email', email)
          .single()
      ]);

      const profile = profileResult.data;
      if (profile) {
        localStorage.setItem('user_role', profile.role || 'user');
        localStorage.setItem('user_avatar_style', profile.avatar_style || 'avataaars');
        localStorage.setItem('user_password_changed', String(profile.password_changed ?? true));
        localStorage.setItem('user_client_id', profile.client_id || '');
      }

      // Definir a flag de sessão ativa para evitar o logout imediato no primeiro carregamento do layout
      sessionStorage.setItem('asthros_session_active', 'true');

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {videoSrc && (
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          preload="none"
          className={styles.videoBackground}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
      <div className={styles.videoOverlay} />
      <div className={styles.backgroundGlow} />
      
      <div className={`${styles.loginCard} glass`}>
        <div className={styles.header}>
          <img src="/asthros-leads.png" alt="Asthros Leads" className={styles.logoImg} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">E-mail</label>
            <input 
              id="email"
              type="email" 
              placeholder="seu@email.com" 
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Senha</label>
            <input 
              id="password"
              type="password" 
              placeholder="••••••••" 
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'AUTENTICANDO...' : 'ENTRAR NO SISTEMA'}
          </button>
        </form>

        <div className={styles.footer}>
          <span>Não tem acesso? <br /></span>
          <a href="#">Fale com o Administrador</a>
        </div>
      </div>

      <p className={styles.copyright}>
        © {new Date().getFullYear()} - Todos os direitos reservados.
      </p>
    </div>
  );
}
