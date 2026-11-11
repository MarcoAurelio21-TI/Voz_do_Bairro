(function () {
    'use strict';

    /* ---------------- 1) CONFIG ---------------- */
    const CLASSE_VISIVEL    = 'anim-visivel';
    const PASSO_DELAY       = 130;
    const LETRA_DELAY       = 30;
    const DURACAO_CONTADOR  = 1100;
    const SKELETON_MS       = 300;
    const QTD_RECENTES      = 3;

    const CHAVE_OCORRENCIAS = 'vozBairro:ocorrencias';
    const CHAVE_BAIRRO      = 'vozBairro:bairro';

    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const SECOES = [
        { seletor: '.secao-categorias',  direcao: 'escala',     stagger: 110 },
        { seletor: '.secao-mural',       direcao: 'de-baixo',   stagger: 110 },
        { seletor: '.secao-depoimentos', direcao: 'da-direita', stagger: 130 },
        { seletor: '.secao-sobre',       direcao: 'de-baixo',   stagger: 140 },
        { seletor: '.secao-equipe',      direcao: 'escala',     stagger: 120 }
    ];

    /* ---------------- 2) HELPERS ---------------- */
    function escaparHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function forcarReflow() { void document.body.offsetHeight; }

    function delayDoElemento(el) {
        let n = 0;
        el.classList.forEach(function (c) {
            const m = c.match(/^delay-(\d+)$/);
            if (m) n = parseInt(m[1], 10);
        });
        return n * PASSO_DELAY;
    }

    function revelarVarios(itens) {
        itens = itens.filter(function (i) { return !!i.el; });
        if (!itens.length) return;
        itens.forEach(function (item) {
            if (item.direcao && !item.el.classList.contains('anim-' + item.direcao)) {
                item.el.classList.add('anim-' + item.direcao);
            }
        });
        forcarReflow();
        itens.forEach(function (item) {
            if (typeof item.delay === 'number') {
                item.el.style.transitionDelay = item.delay + 'ms';
            }
            item.el.classList.add(CLASSE_VISIVEL);
        });
    }

    /* ---------------- 3) NOME DO BAIRRO ---------------- */
    function configurarNomeBairro() {
        const el = document.getElementById('nome-bairro-dinamico');
        if (!el || el.querySelector('.letra')) return;
        let nome = 'nosso bairro';
        try {
            if (typeof CONFIG !== 'undefined' && CONFIG.NOME_BAIRRO) {
                nome = CONFIG.NOME_BAIRRO;
            } else if (localStorage.getItem(CHAVE_BAIRRO)) {
                nome = localStorage.getItem(CHAVE_BAIRRO);
            }
        } catch (e) {}
        el.textContent = nome;
    }

    /* ---------------- 4) IMAGENS (fade) ---------------- */
    function ativarImagem(img) {
        if (!img || img.dataset.fadeAtivado) return;
        img.dataset.fadeAtivado = 'true';
        if (!img.hasAttribute('data-fade')) img.setAttribute('data-fade', '');
        function ok() {
            if (!img.classList.contains('img-carregada')) img.classList.add('img-carregada');
        }
        if (img.complete && img.naturalWidth > 0) {
            requestAnimationFrame(function () { requestAnimationFrame(ok); });
            return;
        }
        img.addEventListener('load', ok, { once: true });
        img.addEventListener('error', function () { setTimeout(ok, 100); }, { once: true });
        setTimeout(ok, 2000);
    }
    function animarImagensGerais() {
        document.querySelectorAll('img:not(.card-mural-foto)').forEach(ativarImagem);
    }

    /* ---------------- 5) CONTADOR ---------------- */
    function animarContador(el, alvo) {
        if (isNaN(alvo) || alvo < 0) return;
        if (semMovimento) { el.textContent = alvo; return; }
        const inicio = performance.now();
        el.textContent = '0';
        function passo(agora) {
            const p = Math.min((agora - inicio) / DURACAO_CONTADOR, 1);
            const s = 1 - Math.pow(1 - p, 4);
            el.textContent = Math.round(alvo * s);
            if (p < 1) requestAnimationFrame(passo);
            else {
                el.textContent = alvo;
                el.classList.add('stat-pulso');
                setTimeout(function () { el.classList.remove('stat-pulso'); }, 500);
            }
        }
        requestAnimationFrame(passo);
    }

    /* ---------------- 6) DADOS DO MURAL ---------------- */
    function obterOcorrencias() {
        try {
            if (typeof listarOcorrencias === 'function') {
                const l = listarOcorrencias();
                if (Array.isArray(l)) return l;
            }
        } catch (e) {}
        try {
            const bruto = localStorage.getItem(CHAVE_OCORRENCIAS);
            const lista = bruto ? JSON.parse(bruto) : [];
            return Array.isArray(lista) ? lista : [];
        } catch (e) { return []; }
    }
    function classificarStatus(s) {
        s = (s || '').toLowerCase();
        if (s.indexOf('conclu') !== -1) return 'concluido';
        if (s.indexOf('andament') !== -1) return 'andamento';
        return 'aberto';
    }
    function carregarEstatisticas() {
        const lista = obterOcorrencias();
        const c = { aberto: 0, andamento: 0, concluido: 0 };
        lista.forEach(function (oc) { c[classificarStatus(oc.status)]++; });
        document.querySelectorAll('#estatisticas-vivo [data-stat]').forEach(function (el) {
            animarContador(el, c[el.dataset.stat] || 0);
        });
    }
    function fmtData(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d)) return '';
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return ''; }
    }
    function rotuloCat(cat) {
        const m = {
            animais: 'Animais', seguranca: 'Segurança', infraestrutura: 'Infraestrutura',
            'sos-mulher': 'SOS Mulher', limpeza: 'Limpeza', outros: 'Outros'
        };
        return m[(cat || '').toLowerCase()] || (cat || 'Outros');
    }
    function rotuloStatus(s) {
        const k = classificarStatus(s);
        return k === 'concluido' ? 'Concluída' : k === 'andamento' ? 'Em andamento' : 'Em aberto';
    }

    /* ---------------- 7) CARD DO MURAL ---------------- */
    function criarCard(oc) {
        const card = document.createElement('article');
        card.className = 'card-mural';
        card.dataset.status = classificarStatus(oc.status);
        card.setAttribute('data-tilt', '');
        card.dataset.tiltStrength = '12';

        const data   = fmtData(oc.data || oc.criadoEm);
        const titulo = oc.titulo || 'Ocorrência sem título';
        const desc   = oc.descricao || '';
        const resumo = desc.length > 140 ? desc.slice(0, 140).trim() + '…' : desc;
        const foto   = oc.foto || oc.imagem || oc.fotoUrl || '';

        const fotoHtml = foto
            ? '<div class="card-mural-foto-wrap">' +
                  '<img src="' + escaparHtml(foto) + '" alt="" class="card-mural-foto" data-fade loading="lazy">' +
              '</div>'
            : '';

        card.innerHTML =
            fotoHtml +
            '<header class="card-mural-topo">' +
                '<span class="badge-categoria">' + escaparHtml(rotuloCat(oc.categoria)) + '</span>' +
                '<span class="badge-status status-' + classificarStatus(oc.status) + '">' +
                    escaparHtml(rotuloStatus(oc.status)) +
                '</span>' +
            '</header>' +
            '<h3 class="card-mural-titulo">' + escaparHtml(titulo) + '</h3>' +
            (resumo ? '<p class="card-mural-resumo">' + escaparHtml(resumo) + '</p>' : '') +
            (data   ? '<footer class="card-mural-rodape">' + escaparHtml(data) + '</footer>' : '');

        const img = card.querySelector('.card-mural-foto');
        if (img) {
            ativarImagem(img);
            img.addEventListener('error', function () {
                const wrap = img.closest('.card-mural-foto-wrap');
                if (wrap) wrap.remove();
            }, { once: true });
        }
        return card;
    }
    function esqueleto() {
        const d = document.createElement('div');
        d.className = 'card-mural skeleton-card';
        d.innerHTML =
            '<div class="skeleton-linha skeleton-curta"></div>' +
            '<div class="skeleton-linha skeleton-longa"></div>' +
            '<div class="skeleton-linha skeleton-media"></div>';
        return d;
    }
    function carregarMural() {
        const container = document.getElementById('mural-recente');
        if (!container) return;
        const lista = obterOcorrencias();
        if (!lista.length) {
            container.innerHTML =
                '<p class="feed-vazio">Nenhuma ocorrência ainda. ' +
                '<a href="./html/nova-ocorrencia.html">Seja o primeiro!</a></p>';
            return;
        }
        lista.sort(function (a, b) {
            return new Date(b.data || b.criadoEm || 0).getTime() -
                   new Date(a.data || a.criadoEm || 0).getTime();
        });
        const recentes = lista.slice(0, QTD_RECENTES);
        container.innerHTML = '';
        recentes.forEach(function () { container.appendChild(esqueleto()); });
        setTimeout(function () {
            container.innerHTML = '';
            const cards = recentes.map(criarCard);
            cards.forEach(function (card) { container.appendChild(card); });
            revelarVarios(cards.map(function (card, i) {
                return { el: card, direcao: 'escala', delay: i * 140 };
            }));
            configurarTilt(container);
        }, SKELETON_MS);
    }

    /* ---------------- 8) HEADER ---------------- */
    function animarHeader() {
        const logo   = document.querySelector('.logo-container');
        const botoes = document.querySelector('.botoes-topo');
        const itens  = document.querySelectorAll('.menu li');
        if (logo)   logo.classList.add('header-anim');
        if (botoes) botoes.classList.add('header-anim');
        itens.forEach(function (li, i) {
            li.classList.add('header-anim-item');
            li.style.transitionDelay = (200 + i * 80) + 'ms';
        });
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                itens.forEach(function (li) { li.classList.add('header-visivel'); });
            });
        });
    }

    /* ---------------- 9) TÍTULO LETRA POR LETRA ---------------- */
    function prepararTitulo() {
        const titulo = document.querySelector('.conteudo-principal .titulo-principal');
        if (!titulo || titulo.dataset.split === 'true') return titulo;
        titulo.classList.remove('anim-entrada', 'delay-1');
        titulo.classList.add('titulo-split');
        titulo.dataset.split = 'true';
        const walker = document.createTreeWalker(titulo, NodeFilter.SHOW_TEXT);
        const textoNodes = [];
        let n;
        while ((n = walker.nextNode())) textoNodes.push(n);
        let idx = 0;
        textoNodes.forEach(function (node) {
            const frag = document.createDocumentFragment();
            for (const ch of node.textContent) {
                if (ch.trim() === '') frag.appendChild(document.createTextNode(ch));
                else {
                    const span = document.createElement('span');
                    span.className = 'letra';
                    span.style.transitionDelay = (idx * LETRA_DELAY) + 'ms';
                    span.textContent = ch;
                    frag.appendChild(span);
                    idx++;
                }
            }
            node.parentNode.replaceChild(frag, node);
        });
        return titulo;
    }

    /* ---------------- 10) HERO ---------------- */
    function animarHero() {
        const titulo    = document.querySelector('.conteudo-principal .titulo-principal');
        const descricao = document.querySelector('.conteudo-principal .descricao');
        const botoes    = document.querySelector('.conteudo-principal .botoes-acao');
        const stats     = document.querySelector('.conteudo-principal .estatisticas');
        const rodape    = document.querySelector('.conteudo-principal .rodape-estatisticas');
        const imagem    = document.querySelector('.coluna-imagem.anim-entrada-imagem');

        if (semMovimento) {
            [titulo, descricao, botoes, stats, rodape, imagem].forEach(function (el) {
                if (el) el.classList.add(CLASSE_VISIVEL);
            });
            carregarEstatisticas();
            return;
        }
        const tituloSplit = prepararTitulo();
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (tituloSplit) tituloSplit.classList.add(CLASSE_VISIVEL);
                revelarVarios([
                    { el: descricao, direcao: 'de-baixo', delay: 350  },
                    { el: botoes,    direcao: 'escala',   delay: 600  },
                    { el: stats,     direcao: 'de-baixo', delay: 900  },
                    { el: rodape,    direcao: 'de-baixo', delay: 1150 }
                ]);
                if (imagem) imagem.classList.add(CLASSE_VISIVEL);
                setTimeout(carregarEstatisticas, 1300);
            });
        });
    }

    /* ---------------- 11) ATMOSFERA ---------------- */
    function criarBlobs() {
        if (semMovimento || document.querySelector('.blobs-decor')) return;
        const wrap = document.createElement('div');
        wrap.className = 'blobs-decor';
        wrap.setAttribute('aria-hidden', 'true');
        wrap.innerHTML =
            '<span class="blob blob-1"></span><span class="blob blob-2"></span>' +
            '<span class="blob blob-3"></span><span class="blob blob-4"></span>';
        document.body.appendChild(wrap);
    }
    function criarMarquee() {
        if (document.querySelector('.marquee-band')) return;
        const hero = document.querySelector('.conteudo-principal');
        if (!hero) return;
        const txt = 'MURAL DO BAIRRO · VIZINHANÇA UNIDA · SEGURANÇA · CUIDADO · COMUNIDADE · ';
        const band = document.createElement('div');
        band.className = 'marquee-band';
        band.setAttribute('aria-hidden', 'true');
        band.innerHTML =
            '<div class="marquee-track">' + txt.repeat(5) + '</div>' +
            '<div class="marquee-track">' + txt.repeat(5) + '</div>';
        hero.after(band);
    }
    function criarProgresso() {
        if (document.querySelector('.scroll-progresso')) return;
        const barra = document.createElement('div');
        barra.className = 'scroll-progresso';
        barra.setAttribute('aria-hidden', 'true');
        document.body.appendChild(barra);
        let agendado = false;
        function atualizar() {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            barra.style.transform = 'scaleX(' + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ')';
            agendado = false;
        }
        window.addEventListener('scroll', function () {
            if (!agendado) { requestAnimationFrame(atualizar); agendado = true; }
        }, { passive: true });
    }
    function parallaxBlobs() {
        if (semMovimento) return;
        const blobs = document.querySelectorAll('.blob');
        if (!blobs.length) return;
        let agendado = false;
        function atualizar() {
            const sy = window.scrollY;
            blobs.forEach(function (b, i) {
                b.style.translate = '0 ' + (sy * (0.1 + i * 0.05)).toFixed(1) + 'px';
            });
            agendado = false;
        }
        window.addEventListener('scroll', function () {
            if (!agendado) { requestAnimationFrame(atualizar); agendado = true; }
        }, { passive: true });
        atualizar();
    }

    /* ---------------- 12) TILT ---------------- */
    function configurarTilt(root) {
        if (semMovimento) return;
        (root || document).querySelectorAll('[data-tilt]:not([data-tilt-ready])').forEach(function (el) {
            el.dataset.tiltReady = 'true';
            const forca = parseFloat(el.dataset.tiltStrength) || 12;

            el.addEventListener('mousemove', function (e) {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width  - 0.5;
                const py = (e.clientY - r.top)  / r.height - 0.5;
                el.style.setProperty('--tilt-x',  (-py * forca).toFixed(2) + 'deg');
                el.style.setProperty('--tilt-y',  ( px * forca).toFixed(2) + 'deg');
                el.style.setProperty('--shine-x', ((px + 0.5) * 100).toFixed(1) + '%');
                el.style.setProperty('--shine-y', ((py + 0.5) * 100).toFixed(1) + '%');
            });
            el.addEventListener('mouseleave', function () {
                el.style.setProperty('--tilt-x', '0deg');
                el.style.setProperty('--tilt-y', '0deg');
            });
        });
    }

    /* ---------------- 13) MAGNÉTICOS ---------------- */
    function configurarMagneticos() {
        if (semMovimento) return;
        document.querySelectorAll('[data-magnetic]').forEach(function (el) {
            el.addEventListener('mousemove', function (e) {
                const r = el.getBoundingClientRect();
                const mx = e.clientX - r.left - r.width  / 2;
                const my = e.clientY - r.top  - r.height / 2;
                el.style.setProperty('--mag-x', (mx * 0.3).toFixed(1) + 'px');
                el.style.setProperty('--mag-y', (my * 0.3).toFixed(1) + 'px');
            });
            el.addEventListener('mouseleave', function () {
                el.style.setProperty('--mag-x', '0px');
                el.style.setProperty('--mag-y', '0px');
            });
        });
    }

    function aplicarTiltMagneticos() {
        document.querySelectorAll(
            '.card-categoria, .card-depoimento, .card-sobre, .card-mural'
        ).forEach(function (el) {
            if (!el.hasAttribute('data-tilt')) el.setAttribute('data-tilt', '');
            if (!el.dataset.tiltStrength) el.dataset.tiltStrength = '12';
        });
        
        document.querySelectorAll('.polaroid, .polaroid-equipe').forEach(function (el) {
            if (!el.hasAttribute('data-tilt')) el.setAttribute('data-tilt', '');
            if (!el.dataset.tiltStrength) el.dataset.tiltStrength = '18';
        });

        document.querySelectorAll(
            '.btn-abrir-mural, .btn-registrar-mural, .btn-registrar-topo, .btn-entrar'
        ).forEach(function (el) { el.setAttribute('data-magnetic', ''); });
    }

    /* ---------------- 14) SCROLL REVEAL ---------------- */
    function observarSecao(config) {
        const secao = document.querySelector(config.seletor);
        if (!secao) return;
        const elementos = secao.querySelectorAll('.anim-entrada');
        if (!elementos.length) return;
        function revelarSecao() {
            revelarVarios(Array.from(elementos).map(function (el, i) {
                const temDelay = /(^|\s)delay-\d+/.test(el.className);
                return {
                    el: el,
                    direcao: config.direcao,
                    delay: temDelay ? delayDoElemento(el) : i * config.stagger
                };
            }));
        }
        if (!('IntersectionObserver' in window)) { revelarSecao(); return; }
        const obs = new IntersectionObserver(function (entradas) {
            entradas.forEach(function (e) {
                if (!e.isIntersecting) return;
                revelarSecao();
                obs.disconnect();
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
        obs.observe(secao);
    }
    function scrollSuave() {
        document.querySelectorAll('a[href^="#"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                const href = a.getAttribute('href');
                if (!href || href === '#') return;
                const destino = document.querySelector(href);
                if (!destino) return;
                e.preventDefault();
                destino.scrollIntoView({
                    behavior: semMovimento ? 'auto' : 'smooth',
                    block: 'start'
                });
            });
        });
    }

    /* ---------------- 15) INIT ---------------- */
    function iniciar() {
        configurarNomeBairro();
        criarBlobs();
        criarMarquee();
        criarProgresso();
        animarImagensGerais();
        animarHeader();
        animarHero();
        SECOES.forEach(observarSecao);
        scrollSuave();
        parallaxBlobs();
        aplicarTiltMagneticos();
        configurarTilt();
        configurarMagneticos();
        carregarMural();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();