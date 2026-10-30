// ==========================================
// 1. CONFIGURAÇÃO DO FIREBASE (SISTEMA HÍBRIDO)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAt2ce0_8REpyy_0v0HzJZoYKzgF529HI0",
  authDomain: "triagem-lab.firebaseapp.com",
  databaseURL: "https://triagem-lab-default-rtdb.firebaseio.com",
  projectId: "triagem-lab",
  storageBucket: "triagem-lab.firebasestorage.app",
  messagingSenderId: "621280430865",
  appId: "1:621280430865:web:acf193b814489dba599ab0",
  measurementId: "G-88VX9BK459"
};

// VARIÁVEIS GLOBAIS
let entregas = [];
let parceiros = [];
let timerInterval;
let tempoRestante = 300;
let db = null;
let usaFirebase = false;

// Tenta iniciar o Firebase apenas se as chaves foram alteradas
try {
    if (firebaseConfig.apiKey !== "SUA_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        usaFirebase = true;
        console.log("Modo Nuvem: Firebase ativado em tempo real!");
    } else {
        console.warn("Modo Local: Chaves do Firebase não configuradas. Funcionando offline.");
    }
} catch (e) {
    console.error("Erro ao iniciar Firebase, caindo para modo Local.", e);
    usaFirebase = false;
}

// ==========================================
// 2. INICIALIZAÇÃO GERAL
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    iniciarRelogio();
    carregarTema();
    configurarTimer();
    
    if (usaFirebase) {
        ouvirParceirosFirebase();
        ouvirEntregasFirebase();
    } else {
        carregarParceirosLocal();
        carregarEntregasLocal();
    }

    // Sincroniza abas no mesmo navegador (Modo Local)
    window.addEventListener('storage', (e) => {
        if (!usaFirebase) {
            if (e.key === 'malotes_dados') carregarEntregasLocal();
            if (e.key === 'malotes_parceiros') carregarParceirosLocal();
        }
    });
});

// ==========================================
// 3. COMUNICAÇÃO DE DADOS (FIREBASE OU LOCAL)
// ==========================================

function ouvirParceirosFirebase() {
    db.ref('parceiros').on('value', (snapshot) => {
        const dados = snapshot.val();
        if (dados) {
            parceiros = Array.isArray(dados) ? dados : Object.values(dados).filter(Boolean);
        } else {
            parceiros = ["Hospital São Luiz", "Clínica Santa Maria", "UBS Central", "Hospital Metropolitano"];
            db.ref('parceiros').set(parceiros);
        }
        renderizarSelectUnidade();
        if(!document.getElementById('modalParceiros').classList.contains('hidden')) {
            renderizarListaParceirosModal();
        }
    });
}

function carregarParceirosLocal() {
    const salvos = localStorage.getItem('malotes_parceiros');
    if (salvos) {
        parceiros = JSON.parse(salvos);
    } else {
        parceiros = ["Hospital São Luiz", "Clínica Santa Maria", "UBS Central", "Hospital Metropolitano"];
        localStorage.setItem('malotes_parceiros', JSON.stringify(parceiros));
    }
    renderizarSelectUnidade();
}

function atualizarParceirosNoBanco() {
    if (usaFirebase) {
        db.ref('parceiros').set(parceiros);
    } else {
        localStorage.setItem('malotes_parceiros', JSON.stringify(parceiros));
        renderizarSelectUnidade();
        renderizarListaParceirosModal();
    }
}

function ouvirEntregasFirebase() {
    db.ref('entregas').on('value', (snapshot) => {
        const dados = snapshot.val();
        entregas = [];
        if (dados) {
            for (let key in dados) {
                entregas.push({ id: key, ...dados[key] });
            }
            entregas.sort((a, b) => b.timestamp - a.timestamp);
        }
        renderizarSidebarP1();
        renderizarPainel2();
    });
}

function carregarEntregasLocal() {
    const salvos = localStorage.getItem('malotes_dados');
    entregas = salvos ? JSON.parse(salvos) : [];
    renderizarSidebarP1();
    renderizarPainel2();
}

// ==========================================
// 4. AÇÕES DE REGISTRO E STATUS
// ==========================================

function registrarMalote(e) {
    e.preventDefault();
    const agora = new Date();
    
    const novoMalote = {
        id: 'mlt_' + Date.now(),
        recebidoPor: document.getElementById('recebidoPor').value,
        nomeMotorista: document.getElementById('nomeMotorista').value,
        unidade: document.getElementById('selectUnidade').value,
        codigoMalote: document.getElementById('codigoMalote').value || '-',
        numeroCaixa: document.getElementById('numeroCaixa').value || '-',
        temperatura: document.getElementById('temperatura').value ? document.getElementById('temperatura').value + ' °C' : '-',
        condicaoCaixa: document.getElementById('condicaoCaixa').value,
        tipoExame: document.getElementById('tipoExame').value,
        observacao: document.getElementById('observacao').value || '',
        data: agora.toLocaleDateString('pt-BR'),
        horario: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: agora.getTime(),
        status: 'Recém-Chegado'
    };

    if (usaFirebase) {
        db.ref('entregas').push(novoMalote);
    } else {
        entregas.unshift(novoMalote);
        localStorage.setItem('malotes_dados', JSON.stringify(entregas));
        carregarEntregasLocal(); 
    }
    
    limparFormularioParcial();
    alert("Malote registrado com sucesso!");
}

function atualizarStatus(id, novoStatus) {
    if (usaFirebase) {
        db.ref('entregas/' + id).update({ status: novoStatus });
    } else {
        const index = entregas.findIndex(e => e.id === id);
        if (index !== -1) {
            entregas[index].status = novoStatus;
            localStorage.setItem('malotes_dados', JSON.stringify(entregas));
            carregarEntregasLocal();
        }
    }
}

function limparFormularioParcial() {
    document.getElementById('selectUnidade').value = '';
    document.getElementById('codigoMalote').value = '';
    document.getElementById('numeroCaixa').value = '';
    document.getElementById('temperatura').value = '';
    document.getElementById('observacao').value = '';
}

// ==========================================
// 5. GERENCIAMENTO DE UNIDADES E MODAL
// ==========================================

function abrirModalParceiros() {
    document.getElementById('modalParceiros').classList.remove('hidden');
    renderizarListaParceirosModal();
}

function fecharModalParceiros() {
    document.getElementById('modalParceiros').classList.add('hidden');
}

function renderizarListaParceirosModal() {
    const ul = document.getElementById('listaParceirosModal');
    ul.innerHTML = '';
    
    const parceirosOrdenados = [...parceiros].sort();
    
    parceirosOrdenados.forEach((p) => {
        const indexReal = parceiros.indexOf(p);
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 transition';
        li.innerHTML = `
            <span class="font-medium">${p}</span>
            <button onclick="removerParceiro(${indexReal})" title="Remover" class="text-red-500 hover:text-red-700 dark:text-red-400 p-1"><i class="fa-solid fa-trash-can"></i></button>
        `;
        ul.appendChild(li);
    });
}

function adicionarNovaUnidadeModal() {
    const input = document.getElementById('novaUnidadeInput');
    const val = input.value.trim();
    if (val && !parceiros.includes(val)) {
        parceiros.push(val);
        atualizarParceirosNoBanco();
        input.value = '';
    }
}

function removerParceiro(idx) {
    if(confirm("Tem certeza que deseja remover esta unidade permanentemente?")) {
        parceiros.splice(idx, 1);
        atualizarParceirosNoBanco();
    }
}

function importarUnidadesExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
            
            let adicionados = 0;
            rows.forEach(row => {
                if (row[0] && typeof row[0] === 'string') {
                    let nome = row[0].trim();
                    if (nome && !parceiros.includes(nome)) {
                        parceiros.push(nome);
                        adicionados++;
                    }
                }
            });

            atualizarParceirosNoBanco();
            alert(`${adicionados} novas unidades foram importadas com sucesso!`);
        } catch (error) {
            alert("Erro ao ler o arquivo Excel. Verifique se os nomes estão na primeira coluna.");
        }
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

// ==========================================
// 6. RENDERIZAÇÃO DA INTERFACE VISUAL
// ==========================================

function renderizarSelectUnidade() {
    const select = document.getElementById('selectUnidade');
    select.innerHTML = '<option value="">Selecione a unidade de origem...</option>';
    let parceirosOrdenados = [...parceiros].sort();
    parceirosOrdenados.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
}

function renderizarSidebarP1() {
    const container = document.getElementById('listaUltimos');
    container.innerHTML = '';
    
    const hoje = new Date().toLocaleDateString('pt-BR');
    const entregasHoje = entregas.filter(e => e.data === hoje);
    document.getElementById('contadorHoje').innerText = `${entregasHoje.length} hoje`;

    if (entregasHoje.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">Nenhum malote registrado hoje.</div>';
        return;
    }

    entregasHoje.slice(0, 10).forEach(item => {
        container.innerHTML += `
            <div class="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-sm text-slate-800 dark:text-white truncate max-w-[180px]">${item.unidade}</h4>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Cx: ${item.numeroCaixa} | ${item.tipoExame}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-bold text-brand dark:text-blue-400">${item.horario}</span>
                </div>
            </div>
        `;
    });
}

function renderizarPainel2() {
    const ativos = entregas.filter(e => e.status !== 'Finalizado');
    const finalizados = entregas.filter(e => e.status === 'Finalizado');

    const grid = document.getElementById('gridCardsTV');
    const tabela = document.getElementById('tabelaFinalizados');

    grid.innerHTML = '';
    tabela.innerHTML = '';

    if (ativos.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-slate-500 font-semibold bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">Nenhum malote pendente no momento.</div>';
    } else {
        ativos.forEach((item) => {
            const isNovo = item.status === 'Recém-Chegado';
            const bordaGlow = isNovo ? 'card-ativo-novo border-red-500' : 'card-ativo-triagem border-yellow-500';
            const badge = isNovo 
                ? '<span class="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase"><i class="fa-solid fa-bell animate-pulse mr-1"></i> Recém-Chegado</span>'
                : '<span class="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px] px-2 py-1 rounded-full font-bold uppercase"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Em Triagem</span>';

            grid.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm ${bordaGlow} flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-2">
                            <span class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">${item.horario} - ${item.data}</span>
                            ${badge}
                        </div>
                        <h3 class="text-xl font-bold text-slate-800 dark:text-white leading-tight mb-3">${item.unidade}</h3>
                        
                        <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div class="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                <span class="text-slate-400 block mb-0.5">Exame</span>
                                <strong class="text-slate-700 dark:text-slate-200 truncate block">${item.tipoExame}</strong>
                            </div>
                            <div class="bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                <span class="text-slate-400 block mb-0.5">Nº Caixa / Temp</span>
                                <strong class="text-slate-700 dark:text-slate-200">${item.numeroCaixa} / ${item.temperatura}</strong>
                            </div>
                        </div>
                        ${item.observacao ? `<p class="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded mb-3 border border-blue-100 dark:border-blue-800/30"><i class="fa-solid fa-circle-info mr-1"></i> ${item.observacao}</p>` : ''}
                    </div>
                    <div class="flex gap-2 mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                        ${isNovo ? `<button onclick="atualizarStatus('${item.id}', 'Em Triagem')" class="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 rounded text-xs transition">Iniciar Triagem</button>` : ''}
                        <button onclick="atualizarStatus('${item.id}', 'Finalizado')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-xs transition">Finalizar</button>
                    </div>
                </div>
            `;
        });
    }

    if (finalizados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">Nenhum malote finalizado.</td></tr>';
    } else {
        finalizados.forEach(item => {
            tabela.innerHTML += `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <td class="px-4 py-3 whitespace-nowrap"><div class="font-bold">${item.horario}</div><div class="text-xs text-slate-400">${item.data}</div></td>
                    <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">${item.unidade}</td>
                    <td class="px-4 py-3 text-xs"><span class="block">Cx: ${item.numeroCaixa}</span><span class="text-slate-400">Cód: ${item.codigoMalote}</span></td>
                    <td class="px-4 py-3 text-xs"><span class="block truncate max-w-[150px]">${item.tipoExame}</span><span class="text-slate-400">${item.condicaoCaixa}</span></td>
                    <td class="px-4 py-3">
                        <span class="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs px-2 py-1 rounded font-bold"><i class="fa-solid fa-check"></i> Finalizado</span>
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-500">
                        Mot: ${item.nomeMotorista}<br>Rec: ${item.recebidoPor}
                    </td>
                </tr>
            `;
        });
    }
}

// ==========================================
// 7. FUNÇÕES AUXILIARES (UI)
// ==========================================

function iniciarRelogio() {
    setInterval(() => {
        const agora = new Date();
        document.getElementById('relogioHeader').innerText = agora.toLocaleTimeString('pt-BR');
        document.getElementById('dataHeader').innerText = agora.toLocaleDateString('pt-BR');
    }, 1000);
}

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    atualizarIconeTema(isDark);
}

function carregarTema() {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
    atualizarIconeTema(isDark);
}

function atualizarIconeTema(isDark) {
    const icone = document.getElementById('iconeTema');
    icone.className = isDark ? 'fa-solid fa-sun text-yellow-400' : 'fa-solid fa-moon text-white';
}

function mudarPainel(painel) {
    document.getElementById('painel1').classList.toggle('hidden', painel !== 'p1');
    document.getElementById('painel2').classList.toggle('hidden', painel !== 'p2');
    const btn1 = document.getElementById('btnNavP1');
    const btn2 = document.getElementById('btnNavP2');
    if (painel === 'p1') {
        btn1.className = 'px-4 py-2 rounded font-semibold text-sm bg-white text-brand shadow flex items-center transition-all';
        btn2.className = 'px-4 py-2 rounded font-semibold text-sm text-blue-100 hover:text-white flex items-center transition-all';
    } else {
        btn2.className = 'px-4 py-2 rounded font-semibold text-sm bg-white text-brand shadow flex items-center transition-all';
        btn1.className = 'px-4 py-2 rounded font-semibold text-sm text-blue-100 hover:text-white flex items-center transition-all';
    }
}

function configurarTimer() {
    clearInterval(timerInterval);
    const val = parseInt(document.getElementById('tempoRefresh').value);
    const display = document.getElementById('cronometroTV');
    
    if (val === 0) {
        display.innerText = '--:--';
        return;
    }
    
    tempoRestante = val;
    timerInterval = setInterval(() => {
        tempoRestante--;
        const m = Math.floor(tempoRestante / 60).toString().padStart(2, '0');
        const s = (tempoRestante % 60).toString().padStart(2, '0');
        display.innerText = `${m}:${s}`;
        
        if (tempoRestante <= 0) {
            tempoRestante = val;
            if(!usaFirebase) carregarEntregasLocal(); // No modo local, força o F5 dos dados
        }
    }, 1000);
}

function exportarExcel() {
    if (entregas.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(entregas.map(i => ({
        "Data": i.data, "Horário": i.horario, "Status": i.status, "Unidade": i.unidade,
        "Tipo de Exame": i.tipoExame, "Nº Caixa": i.numeroCaixa, "Temperatura": i.temperatura,
        "Condição Caixa": i.condicaoCaixa, "Código Malote": i.codigoMalote, 
        "Recebido Por": i.recebidoPor, "Motorista": i.nomeMotorista, "Observações": i.observacao
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico");
    XLSX.writeFile(workbook, `TriagemLab_Relatorio_${new Date().toISOString().split('T')[0]}.xlsx`);
}