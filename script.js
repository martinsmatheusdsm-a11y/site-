/* =========================================================================
   script.js — presente de fim de ano
   Tudo que você provavelmente vai querer ajustar está no bloco CONFIG e
   na lista FOTOS_EXTRAS logo abaixo. O resto é a mecânica do site.
   ========================================================================= */
'use strict';

/* ---------- CONFIGURAÇÃO (ajuste aqui) ---------- */
const CONFIG = {
  /* MÚSICAS (tocam pelo YouTube, no player do canto da tela)
     Em "youtube" vai o código do vídeo (o que vem depois de "watch?v=" no link).
     Se o 1º código não puder tocar fora do YouTube, o site tenta o próximo. */
  musicas: {
    andanca:  { titulo: 'Andança',                artista: 'Beth Carvalho · ao vivo', youtube: ['Zav50SgbK8o', '4e0JpwNbAvQ', 'JUCJR0v9aFQ'] },
    palacios: { titulo: 'Palácios e Castelos',    artista: 'João Gomes',              youtube: ['9pFzVeYrFOM', '3IEeuZ8kJD0', 'zoCOAUpdsIo'] },
    naoPenso: { titulo: 'Não Penso em Mais Nada', artista: 'Arlindo Cruz',            youtube: ['hPKi47J5UYY', 'BIb2jnpOIeI'] },
  },
  // ordem das músicas no quadro e na sequência (Andança é sempre a primeira).
  // Quando uma acaba, toca a próxima da lista; depois da última, volta para a primeira.
  ordemMusicas: ['andanca', 'palacios', 'naoPenso'],

  /* ONDE FICA O SEU ÁUDIO
     'inicio' = logo depois da capa (antes das fotos)
     'fim'    = depois do "mas calma... tenho mais uma surpresa..."
     Dá para testar a outra opção sem mexer aqui, só mudando o link:
     .../?audio=fim  ou  .../?audio=inicio */
  posicaoAudio: 'inicio',

  // sua mensagem gravada (tenta o 1º arquivo; se não existir, o próximo)
  meuAudio: ['assets/audio/meu-audio.mp3', 'assets/audio/meu-audio.ogg'],

  // início do namoro, para o contador do final (horário de Brasília)
  inicioNamoro: '2026-01-01T00:00:00-03:00',

  volumeMusica: 60,      // volume das músicas (0 a 100)
  duracaoFade: 1500,     // duração das entradas/saídas de volume, em ms
  pastaExtras: 'assets/fotos/extras/',
};

/* ---------- FOTOS SEM LEGENDA ----------
   Uma por página, nesta ordem (a ordem em que você mandou). Os arquivos ficam
   em assets/fotos/extras/. Para tirar uma foto, apague o nome dela daqui. */
const FOTOS_EXTRAS = [
  'extra-19.jpg', 'extra-16.jpg', 'extra-17.jpg', 'extra-18.jpg', 'extra-21.jpg',
  'extra-20.jpg', 'extra-22.jpg', 'extra-24.jpg', 'extra-23.jpg', 'extra-27.jpg',
  'extra-25.jpg', 'extra-26.jpg', 'extra-30.jpg', 'extra-28.jpg', 'extra-29.jpg',
  'extra-32.jpg', 'extra-31.jpg', 'extra-34.jpg', 'extra-33.jpg', 'extra-36.jpg',
  'extra-35.jpg', 'extra-38.jpg', 'extra-37.jpg', 'extra-06.jpg', 'extra-39.jpg',
  'extra-01.jpg', 'extra-05.jpg', 'extra-02.jpg', 'extra-03.jpg', 'extra-04.jpg',
  'extra-09.jpg', 'extra-07.jpg', 'extra-08.jpg', 'extra-13.jpg', 'extra-10.jpg',
  'extra-11.jpg', 'extra-12.jpg', 'extra-15.jpg', 'extra-14.jpg',
];

/* =========================================================================
   Daqui para baixo é a mecânica. Mexa se quiser, mas não precisa.
   ========================================================================= */

const $ = (sel) => document.querySelector(sel);

// posição do áudio: o link (?audio=fim / ?audio=inicio) tem prioridade sobre o CONFIG
const POSICAO_AUDIO = (() => {
  const p = new URLSearchParams(location.search).get('audio');
  return p === 'fim' || p === 'inicio' ? p : CONFIG.posicaoAudio;
})();

const entradaEl   = $('#entrada');
const btnEntrar   = $('#btn-entrar');
const conteudo    = $('#conteudo');
const secFinal    = $('#final');
const aviso       = $('#aviso');

const player        = $('#player');
const playerBtn     = $('#player-btn');
const playerRotulo  = $('#player-rotulo');
const playerTitulo  = $('#player-titulo');
const playerArtista = $('#player-artista');
const btnLista      = $('#btn-lista');
const listaMusicas  = $('#lista-musicas');
const listaItens    = $('#lista-itens');

const meuAudio      = $('#meu-audio');
const secMensagem   = $('#mensagem');
const msgBtn        = $('#msg-btn');
const msgDica       = $('#msg-dica');
const msgTempo      = $('#msg-tempo');
const barra         = $('#progresso-barra');
const btnPular      = $('#btn-pular');
const btnContinuar  = $('#btn-continuar');

const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- estado ---------- */
let modo = 'entrada';           // 'entrada' | 'mensagem' (áudio tocando, música parada) | 'livre'
let somAtivo = true;            // a pessoa deixou a música ligada?
let meuAudioDisponivel = null;  // null = carregando; true/false depois
let mensagemFeita = false;      // já passou pela página do áudio?

/* ---------- utilidades ---------- */
let avisoTimer = null;
function mostrarAviso(texto, duracao = 6000) {
  clearTimeout(avisoTimer);
  aviso.textContent = texto;
  aviso.hidden = false;
  aviso.onclick = () => { aviso.hidden = true; };
  avisoTimer = setTimeout(() => { aviso.hidden = true; }, duracao);
}

const suavizar = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function formatarTempo(s) {
  if (!isFinite(s)) return '0:00';
  s = Math.max(0, Math.floor(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* =========================================================================
   MÚSICA — player do YouTube visível no canto + quadro de escolha
   ========================================================================= */

const M = {
  chave: CONFIG.ordemMusicas[0],  // música atual
  idx: 0,                         // qual código da lista "youtube" está em uso
  querTocando: false,             // o site quer música tocando agora?
  saindo: false,                  // já começou o fade do fim da faixa?
};

let yt = null;
let ytPronto = false;
let ytFalhou = false;
let pedidoPendente = false;  // pediram para tocar antes do player ficar pronto
let pausaNossa = false;      // a última pausa foi o site que pediu (não a pessoa)
let falhasSeguidas = 0;

const idDe = (chave, idx) => (CONFIG.musicas[chave].youtube || [])[idx];

function carregarYouTube() {
  // o YouTube não toca em página aberta direto do arquivo (file://)
  if (location.protocol === 'file:') { ytFalhou = true; return; }

  window.onYouTubeIframeAPIReady = () => {
    const vars = { playsinline: 1, controls: 0, disablekb: 1, rel: 0, fs: 0, iv_load_policy: 3 };
    if (location.origin && location.origin !== 'null') vars.origin = location.origin;
    yt = new YT.Player('yt-player', {
      width: 160, height: 90,
      videoId: idDe(M.chave, M.idx),          // já deixa Andança carregada
      playerVars: vars,
      events: {
        onReady: () => {
          ytPronto = true;
          if (pedidoPendente) { pedidoPendente = false; tocarAtual(); }
        },
        onStateChange: aoMudarEstado,
        onError: aoErro,
      },
    });
  };
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = () => { ytFalhou = true; };
  document.head.appendChild(s);
}

/* Começa a música `chave` do início. */
function tocarMusica(chave) {
  if (M.chave !== chave) M.idx = 0;
  M.chave = chave;
  M.querTocando = true;
  M.saindo = false;
  playerTitulo.textContent = CONFIG.musicas[chave].titulo;
  playerArtista.textContent = CONFIG.musicas[chave].artista;
  atualizarLista();
  tocarAtual();
  vigiar();
}

function tocarAtual() {
  if (ytFalhou) {
    mostrarAviso(location.protocol === 'file:'
      ? 'para a música tocar, abra o site pelo link (não pelo arquivo)'
      : 'não consegui carregar o YouTube', 9000);
    return;
  }
  if (!ytPronto) { pedidoPendente = true; return; }
  const id = idDe(M.chave, M.idx);
  if (!id) { musicaFalhou(); return; }

  yt.setVolume(0);
  const carregado = yt.getVideoData && yt.getVideoData().video_id === id;
  if (!somAtivo) { if (!carregado) yt.cueVideoById(id); return; }
  if (carregado) { yt.seekTo(0, true); yt.playVideo(); }
  else yt.loadVideoById(id);
}

function estaTocando() {
  return !!(ytPronto && yt.getPlayerState() === YT.PlayerState.PLAYING);
}

function pausarYt() {
  if (!ytPronto) return;
  const s = yt.getPlayerState();
  if (s === YT.PlayerState.PLAYING || s === YT.PlayerState.BUFFERING) pausaNossa = true;
  yt.pauseVideo();
}

function aoMudarEstado(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING) {
    if (modo === 'mensagem' || modo === 'entrada') { pausarYt(); return; }
    // tocando (seja porque o site pediu, seja porque ela tocou no vídeo)
    somAtivo = true;
    M.querTocando = true;
    falhasSeguidas = 0;
    if (yt.getCurrentTime() < 2) M.saindo = false;
    player.classList.remove('precisa-toque');
    fadeMusica(CONFIG.volumeMusica);
  } else if (e.data === S.PAUSED) {
    if (pausaNossa) pausaNossa = false;
    else if (modo === 'livre') somAtivo = false;     // ela pausou
  } else if (e.data === S.ENDED) {
    M.saindo = false;
    proximaMusica();
  }
  atualizarPlayer();
}

/* vídeo removido / bloqueado fora do YouTube: tenta o próximo código */
function aoErro(e) {
  console.warn('YouTube: erro', e && e.data, 'no vídeo', idDe(M.chave, M.idx));
  M.idx++;
  if (!idDe(M.chave, M.idx)) { if (M.querTocando) musicaFalhou(); return; }
  if (M.querTocando) tocarAtual();
  else yt.cueVideoById(idDe(M.chave, M.idx));
}

function musicaFalhou() {
  mostrarAviso('não consegui tocar ' + CONFIG.musicas[M.chave].titulo);
  if (++falhasSeguidas < CONFIG.ordemMusicas.length) setTimeout(proximaMusica, 1500);
}

/* próxima da lista (depois da última, volta para a primeira) */
function proximaMusica() {
  const ordem = CONFIG.ordemMusicas;
  tocarMusica(ordem[(ordem.indexOf(M.chave) + 1) % ordem.length]);
}

function atualizarPlayer() {
  const tocando = estaTocando();
  player.classList.toggle('tocando', tocando);
  playerBtn.setAttribute('aria-label', tocando ? 'pausar música' : 'tocar música');
  playerRotulo.textContent = player.classList.contains('precisa-toque')
    ? 'toque no vídeo ▶'
    : (tocando ? 'tocando agora' : 'música pausada');
}

/* Fade de volume (0 a 100). Usa setTimeout para funcionar mesmo com a tela apagando. */
let fadeId = 0;
function fadeMusica(alvo, ms = CONFIG.duracaoFade) {
  if (!ytPronto) return Promise.resolve();
  const id = ++fadeId;
  const de = yt.getVolume();
  const inicio = Date.now();
  return new Promise((resolve) => {
    (function passo() {
      if (id !== fadeId) return resolve();
      const t = Math.min(1, (Date.now() - inicio) / ms);
      yt.setVolume(Math.round(de + (alvo - de) * suavizar(t)));
      if (t < 1) setTimeout(passo, 40); else resolve();
    })();
  });
}

async function silenciarMusica() {
  M.querTocando = false;
  await fadeMusica(0);
  pausarYt();
}

/* Se o celular não deixar tocar sozinho, o player pisca pedindo um toque. */
let vigiaTimer = null;
function vigiar() {
  clearTimeout(vigiaTimer);
  vigiaTimer = setTimeout(() => {
    if (!M.querTocando || !somAtivo || modo !== 'livre' || estaTocando()) return;
    player.classList.add('precisa-toque');
    atualizarPlayer();
    // qualquer toque na página já resolve
    const tentar = () => {
      document.removeEventListener('click', tentar, true);
      document.removeEventListener('touchend', tentar, true);
      if (M.querTocando && somAtivo && modo === 'livre' && !estaTocando() && ytPronto) yt.playVideo();
    };
    document.addEventListener('click', tentar, true);
    document.addEventListener('touchend', tentar, true);
  }, 2500);
}

/* fade-out suave nos últimos segundos de cada música */
setInterval(() => {
  if (!M.querTocando || M.saindo || !estaTocando()) return;
  const d = yt.getDuration();
  if (d > 0 && d - yt.getCurrentTime() <= CONFIG.duracaoFade / 1000) { M.saindo = true; fadeMusica(0); }
}, 250);

/* botão de pausa/play do player */
playerBtn.addEventListener('click', () => {
  if (estaTocando()) {
    somAtivo = false;
    fadeMusica(0, 600).then(() => { if (!somAtivo) pausarYt(); });
  } else if (modo === 'livre') {
    somAtivo = true;
    M.querTocando = true;
    if (ytPronto) yt.playVideo(); else tocarAtual();
    vigiar();
  }
});

/* ---------- quadro para escolher a música ---------- */
function montarLista() {
  CONFIG.ordemMusicas.forEach((chave, i) => {
    const m = CONFIG.musicas[chave];
    const li = document.createElement('li');
    li.dataset.chave = chave;
    li.innerHTML =
      '<button type="button">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span><span class="nome"></span><span class="art"></span></span>' +
      '</button>';
    li.querySelector('.nome').textContent = m.titulo;
    li.querySelector('.art').textContent = m.artista;
    li.querySelector('button').addEventListener('click', () => escolherMusica(chave));
    listaItens.appendChild(li);
  });
  atualizarLista();
}
function atualizarLista() {
  listaItens.querySelectorAll('li').forEach((li) => li.classList.toggle('atual', li.dataset.chave === M.chave));
}
function abrirLista(abrir) {
  listaMusicas.hidden = !abrir;
  btnLista.setAttribute('aria-expanded', String(abrir));
}
btnLista.addEventListener('click', (e) => { e.stopPropagation(); abrirLista(listaMusicas.hidden); });
document.addEventListener('click', (e) => { if (!listaMusicas.hidden && !player.contains(e.target)) abrirLista(false); });

/* o toque dela na música também é o gesto que libera o som no iPhone */
function escolherMusica(chave) {
  abrirLista(false);
  if (modo !== 'livre') return;
  somAtivo = true;
  if (chave === M.chave && estaTocando()) return;          // já está tocando essa
  if (chave === M.chave && ytPronto && yt.getCurrentTime() > 1) { M.querTocando = true; yt.playVideo(); vigiar(); return; }
  falhasSeguidas = 0;
  tocarMusica(chave);
}

/* =========================================================================
   SUA MENSAGEM (página do áudio)
   ========================================================================= */
function carregarMeuAudio(i = 0) {
  if (i >= CONFIG.meuAudio.length) { meuAudioDisponivel = false; return; }
  meuAudio.onerror = () => carregarMeuAudio(i + 1);
  meuAudio.onloadedmetadata = () => { meuAudioDisponivel = true; msgTempo.textContent = formatarTempo(meuAudio.duration); };
  meuAudio.src = CONFIG.meuAudio[i];
  meuAudio.load();
}

/* Com o áudio no fim, ele é "destravado" em silêncio no clique de "entrar",
   para o iPhone deixar ele tocar sozinho depois. */
function destravarMeuAudio() {
  meuAudio.muted = true;
  const p = meuAudio.play();
  const voltar = () => { meuAudio.pause(); meuAudio.currentTime = 0; meuAudio.muted = false; };
  if (p && p.then) p.then(voltar).catch(() => { meuAudio.muted = false; });
  else voltar();
}

function tocarMensagem() {
  secMensagem.classList.remove('precisa-toque');
  msgDica.hidden = true;
  meuAudio.muted = false;
  const p = meuAudio.play();
  if (p && p.catch) p.catch(() => pedirToqueMensagem());
  // se em 1,5 s não começou, o botão pulsa pedindo um toque
  setTimeout(() => { if (meuAudio.paused && meuAudio.currentTime === 0 && modo === 'mensagem') pedirToqueMensagem(); }, 1500);
}
function pedirToqueMensagem() {
  secMensagem.classList.add('precisa-toque');
  msgDica.hidden = false;
}

/* Abre a página do áudio: música para, a tela fica parada e o áudio toca. */
let continuarTimer = null;
function abrirMensagem() {
  modo = 'mensagem';
  clearTimeout(vigiaTimer);
  abrirLista(false);
  player.classList.remove('mostrar', 'precisa-toque');
  window.scrollTo(0, secMensagem.offsetTop);
  travarScroll();
  if (meuAudioDisponivel === false) {
    msgDica.textContent = 'falta o arquivo ' + CONFIG.meuAudio[0];
    msgDica.hidden = false;
    mostrarContinuar();
    return;
  }
  meuAudio.currentTime = 0;
  tocarMensagem();                      // no modo "inicio" isto roda dentro do toque em "entrar"
  if (M.querTocando || estaTocando()) silenciarMusica();
}

function mostrarContinuar() {
  barra.style.width = '100%';
  secMensagem.classList.add('terminou');
  btnContinuar.hidden = false;
  clearTimeout(continuarTimer);
  continuarTimer = setTimeout(continuar, 25000);    // se ninguém tocar, segue sozinho
}

/* "continuar" (ou "pular"): libera a tela e começa a música certa. */
function continuar() {
  if (modo !== 'mensagem') return;
  clearTimeout(continuarTimer);
  mensagemFeita = true;
  modo = 'livre';
  meuAudio.pause();
  btnContinuar.hidden = true;
  secMensagem.classList.add('terminou');
  liberarScroll();
  player.classList.add('mostrar');

  // áudio no início: agora começa Andança. Áudio no fim: Palácios e Castelos.
  somAtivo = true;
  falhasSeguidas = 0;
  tocarMusica(POSICAO_AUDIO === 'inicio' ? CONFIG.ordemMusicas[0] : (CONFIG.ordemMusicas[1] || CONFIG.ordemMusicas[0]));

  const proximo = POSICAO_AUDIO === 'inicio' ? $('#narrativa') : $('#fotos-extras');
  setTimeout(() => window.scrollTo({ top: proximo.offsetTop, behavior: menosMovimento ? 'auto' : 'smooth' }), 250);
}
btnContinuar.addEventListener('click', continuar);
btnPular.addEventListener('click', continuar);

msgBtn.addEventListener('click', () => {
  if (meuAudioDisponivel === false) { continuar(); return; }
  if (meuAudio.paused) {
    if (meuAudio.ended) meuAudio.currentTime = 0;
    if (modo === 'livre') silenciarMusica();          // ouvir de novo depois: a música dá uma pausa
    tocarMensagem();
  } else {
    meuAudio.pause();
  }
});

meuAudio.addEventListener('play', () => {
  if (meuAudio.muted) return;
  secMensagem.classList.add('tocando');
  secMensagem.classList.remove('precisa-toque');
  msgDica.hidden = true;
});
meuAudio.addEventListener('pause', () => secMensagem.classList.remove('tocando'));
meuAudio.addEventListener('timeupdate', () => {
  if (!isFinite(meuAudio.duration) || meuAudio.duration === 0 || meuAudio.muted) return;
  barra.style.width = (meuAudio.currentTime / meuAudio.duration * 100) + '%';
  msgTempo.textContent = formatarTempo(meuAudio.duration - meuAudio.currentTime);
});
meuAudio.addEventListener('ended', () => {
  if (meuAudio.muted) return;
  if (modo === 'mensagem') mostrarContinuar();
  else if (mensagemFeita && somAtivo) { M.querTocando = true; if (ytPronto) yt.playVideo(); vigiar(); }   // ouviu de novo: música volta
});

/* trava/libera a rolagem (o truque do position:fixed funciona no iOS) */
let scrollSalvo = 0;
function travarScroll() {
  scrollSalvo = window.scrollY;
  document.body.style.top = -scrollSalvo + 'px';
  document.body.classList.add('travado');
}
function liberarScroll() {
  document.body.classList.remove('travado');
  document.body.style.top = '';
  window.scrollTo(0, scrollSalvo);
}

/* =========================================================================
   ENTRADA
   ========================================================================= */
btnEntrar.addEventListener('click', entrar);

function entrar() {
  if (modo !== 'entrada') return;
  modo = 'livre';

  conteudo.hidden = false;
  window.scrollTo(0, 0);
  iniciarObservadores();
  iniciarFio();
  iniciarBrilhos();
  iniciarAssinatura();

  // Este toque é o gesto que libera o som no celular.
  if (POSICAO_AUDIO === 'inicio') {
    abrirMensagem();                        // seu áudio começa já
  } else {
    tocarMusica(CONFIG.ordemMusicas[0]);    // Andança começa junto com o texto
    destravarMeuAudio();
    setTimeout(() => player.classList.add('mostrar'), 500);
  }

  entradaEl.classList.add('saindo');
  setTimeout(() => {
    entradaEl.remove();
    document.body.classList.remove('na-entrada');
  }, menosMovimento ? 50 : 950);
}

/* =========================================================================
   ROLAGEM: revelação suave (cada coisa aparece uma vez só)
   ========================================================================= */
function iniciarObservadores() {
  document.querySelectorAll('.texto-intro, .cena .midia, .cena .texto, .carta, .chamada-surpresa, .foto-extra')
    .forEach((el) => el.classList.add('revelar'));

  // Observa os blocos (e não a foto da cena em si: ela começa "recortada" e o
  // navegador acharia que está invisível). Quando o bloco entra na tela, ele e
  // tudo o que tem dentro aparecem.
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.classList.contains('revelar')) el.classList.add('visivel');
      el.querySelectorAll('.revelar').forEach((filho) => filho.classList.add('visivel'));
      obs.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.texto-intro, .cena, .carta, .chamada-surpresa, .foto-extra').forEach((el) => obs.observe(el));

  // com o áudio no fim, a página dele dispara quando metade dela aparece — uma vez só
  if (POSICAO_AUDIO === 'fim') {
    const obsMsg = new IntersectionObserver((entradas, o) => {
      if (!mensagemFeita && modo === 'livre' && entradas.some((e) => e.isIntersecting)) { o.disconnect(); abrirMensagem(); }
    }, { threshold: 0.5 });
    obsMsg.observe(secMensagem);
  }

  prepararMidias();
}

/* Se a foto/vídeo não existir, mostra um bloco com o nome do arquivo esperado. */
function prepararMidias() {
  document.querySelectorAll('.midia img, .midia video').forEach((el) => {
    const quebrou = () => mostrarPlaceholderMidia(el);
    if (el.tagName === 'IMG') {
      if (el.complete && el.naturalWidth === 0 && el.getAttribute('src')) quebrou();
      else el.addEventListener('error', quebrou, { once: true });
    } else {
      if (el.error || el.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) quebrou();
      else el.addEventListener('error', quebrou, { once: true });
      el.addEventListener('loadeddata', () => el.play().catch(() => {}), { once: true });
    }
  });
}
function mostrarPlaceholderMidia(el) {
  const figura = el.closest('.midia');
  if (!figura || figura.classList.contains('faltando')) return;
  figura.classList.add('faltando');
  figura.innerHTML = '<div class="placeholder-texto"><strong>' + (el.tagName === 'VIDEO' ? '🎬' : '📷') +
    '</strong>falta o arquivo<br>' + el.getAttribute('src') + '</div>';
}

/* ---------- fotos sem legenda: uma página para cada foto ---------- */
function montarFotosExtras() {
  const sec = $('#fotos-extras');
  FOTOS_EXTRAS.forEach((nome) => {
    const fig = document.createElement('figure');
    fig.className = 'foto-extra';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.addEventListener('error', () => {
      fig.innerHTML = '<div class="placeholder-texto"><strong>📷</strong>falta o arquivo<br>' + CONFIG.pastaExtras + nome + '</div>';
    });
    img.src = CONFIG.pastaExtras + nome;
    fig.appendChild(img);
    sec.appendChild(fig);
  });
}

/* coloca a página do áudio no lugar escolhido */
function posicionarMensagem() {
  if (POSICAO_AUDIO === 'inicio') {
    const narrativa = $('#narrativa');
    narrativa.parentNode.insertBefore(secMensagem, narrativa);
  }
}

/* =========================================================================
   ENCERRAMENTO: brilhos dourados caindo devagar
   ========================================================================= */
function iniciarBrilhos() {
  if (menosMovimento) return;
  const canvas = $('#brilhos');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cores = ['#c9a26b', '#e3c08d', '#d9a39a', '#b5835a'];
  let w = 0, h = 0, visivel = false;

  function medir() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', medir);
  medir();

  const novo = (topo) => ({
    x: Math.random() * w, y: topo ? -10 : Math.random() * h,
    r: 1.2 + Math.random() * 2.2, v: .25 + Math.random() * .6,
    fase: Math.random() * Math.PI * 2, cor: cores[Math.floor(Math.random() * cores.length)],
    a: .35 + Math.random() * .5,
  });
  let pts = [];

  function quadro() {
    if (!visivel) return;
    if (!pts.length) { medir(); pts = Array.from({ length: 60 }, () => novo(false)); }
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.y += p.v; p.fase += .02;
      const x = p.x + Math.sin(p.fase) * 14;
      if (p.y > h + 10) Object.assign(p, novo(true));
      ctx.globalAlpha = p.a * (.6 + .4 * Math.sin(p.fase * 2));
      ctx.fillStyle = p.cor;
      ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(quadro);
  }
  new IntersectionObserver((es) => {
    const agora = es.some((e) => e.isIntersecting);
    if (agora && !visivel) { visivel = true; requestAnimationFrame(quadro); }
    else if (!agora) visivel = false;
  }, { threshold: 0.1 }).observe(secFinal);
}

/* =========================================================================
   FIO DOURADO: uma linha que liga as fotos e vai se desenhando com a rolagem
   ========================================================================= */
const narrativa = $('#narrativa');
const fio       = $('#fio');
const fioBase   = fio.querySelector('.fio-base');
const fioLinha  = fio.querySelector('.fio-linha');
const fioPonta  = fio.querySelector('.fio-ponta');
let fioComp = 0;         // comprimento total do fio
let fioAmostras = [];    // pontos ao longo do fio (para saber até onde desenhar)

/* Monta o caminho: sai da introdução, desce pela lateral de cada foto
   (do lado de fora, sem passar por cima do texto) e troca de lado entre uma
   foto e outra com uma curva suave. */
function montarFio() {
  const caixa = narrativa.getBoundingClientRect();
  const W = caixa.width, H = narrativa.offsetHeight;
  if (!W || !H) return;
  const rel = (el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left - caixa.left, r: r.right - caixa.left, t: r.top - caixa.top, b: r.bottom - caixa.top };
  };
  fio.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  const seta = rel(narrativa.querySelector('.intro .seta'));
  let x = W / 2, y = seta.b;
  let d = 'M ' + x + ' ' + y;
  const cenas = narrativa.querySelectorAll('.cena');
  cenas.forEach((cena) => {
    const foto = rel(cena.querySelector('.midia'));
    const texto = rel(cena.querySelector('.texto'));
    const esquerda = cena.classList.contains('lado-esq');
    const folga = Math.min(22, (esquerda ? foto.l : W - foto.r) / 2);
    const xm = esquerda ? foto.l - folga : foto.r + folga;
    const y1 = foto.t + 14;
    d += ' C ' + x + ' ' + (y + (y1 - y) * .65) + ', ' + xm + ' ' + (y + (y1 - y) * .35) + ', ' + xm + ' ' + y1;
    const y2 = Math.max(foto.b, texto.b) - 6;
    d += ' L ' + xm + ' ' + y2;
    x = xm; y = y2;
  });
  const fim = rel(cenas[cenas.length - 1]).b;
  d += ' C ' + x + ' ' + (y + (fim - y) * .6) + ', ' + (W / 2) + ' ' + (fim - (fim - y) * .4) + ', ' + (W / 2) + ' ' + fim;

  fioBase.setAttribute('d', d);
  fioLinha.setAttribute('d', d);
  fioComp = fioLinha.getTotalLength();
  fioLinha.style.strokeDasharray = fioComp + ' ' + fioComp;
  fioAmostras = [];
  const N = 500;
  for (let i = 0; i <= N; i++) {
    const len = fioComp * i / N;
    const pt = fioLinha.getPointAtLength(len);
    fioAmostras.push({ len, x: pt.x, y: pt.y });
  }
  atualizarFio();
}

/* Desenha o fio até a altura de ~62% da tela. */
function atualizarFio() {
  if (!fioComp) return;
  if (menosMovimento) { fioLinha.style.strokeDashoffset = 0; fioPonta.style.opacity = 0; return; }
  const alvo = window.innerHeight * 0.62 - narrativa.getBoundingClientRect().top;
  let lo = 0, hi = fioAmostras.length - 1;
  while (lo < hi) {                       // primeiro ponto do fio abaixo do alvo
    const meio = (lo + hi) >> 1;
    if (fioAmostras[meio].y < alvo) lo = meio + 1; else hi = meio;
  }
  const p = fioAmostras[lo];
  const comp = alvo <= fioAmostras[0].y ? 0 : p.len;
  fioLinha.style.strokeDashoffset = fioComp - comp;
  fioPonta.setAttribute('cx', p.x);
  fioPonta.setAttribute('cy', p.y);
  fioPonta.style.opacity = comp > 0 && comp < fioComp ? 1 : 0;
}

function iniciarFio() {
  let pedido = 0;
  const remontar = () => { cancelAnimationFrame(pedido); pedido = requestAnimationFrame(montarFio); };
  let rolando = false;
  window.addEventListener('scroll', () => {
    if (rolando) return;
    rolando = true;
    requestAnimationFrame(() => { rolando = false; atualizarFio(); });
  }, { passive: true });
  window.addEventListener('resize', remontar);
  if ('ResizeObserver' in window) new ResizeObserver(remontar).observe(narrativa);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remontar);
  remontar();
}

/* =========================================================================
   CONTADOR DE DIAS JUNTOS (atualiza a cada segundo)
   ========================================================================= */
function iniciarContador() {
  const inicio = new Date(CONFIG.inicioNamoro).getTime();
  const dois = (n) => String(n).padStart(2, '0');
  const el = { d: $('#cont-dias'), h: $('#cont-horas'), m: $('#cont-min'), s: $('#cont-seg') };
  function tique() {
    let seg = Math.max(0, Math.floor((Date.now() - inicio) / 1000));
    const dias = Math.floor(seg / 86400); seg %= 86400;
    el.d.textContent = dias;
    el.h.textContent = dois(Math.floor(seg / 3600));
    el.m.textContent = dois(Math.floor((seg % 3600) / 60));
    el.s.textContent = dois(seg % 60);
  }
  tique();
  setInterval(tique, 1000);
}

/* A assinatura "se escreve" quando aparece na tela. */
function iniciarAssinatura() {
  const ass = secFinal.querySelector('.assinatura');
  new IntersectionObserver((es, o) => {
    if (es.some((e) => e.isIntersecting)) { secFinal.classList.add('escrevendo'); o.disconnect(); }
  }, { threshold: 0.8 }).observe(ass);
}

/* =========================================================================
   início
   ========================================================================= */
window.scrollTo(0, 0);
posicionarMensagem();
montarFotosExtras();
montarLista();
iniciarContador();
carregarMeuAudio();
carregarYouTube();
