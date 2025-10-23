// ===================================
// グローバル変数
// ===================================

// シミュレーション状態
let simulation = {
    day: 0,                     // 経過日数
    running: false,             // 実行中かどうか
    speed: 1.0,                 // シミュレーション速度

    // 個体群データ
    population: {
        normal: 8,              // 正常個体
        beautiful: 0,           // 美しき者
        aggressive: 0           // 攻撃的個体
    },

    // 環境パラメータ
    maxCapacity: 3000,          // 最大収容数
    currentDensity: 0,          // 現在の密度（0-1）
    socialStress: 0,            // 社会的ストレス（0-1）
    birthRate: 1.0,             // 出生率（0-1）
    deathRate: 0.002,           // 基本死亡率（Phase Dでの絶滅を促進）
    dailyBirths: 0,             // 1日の出生数

    // 履歴データ（グラフ用）
    history: {
        days: [],               // 日数の配列
        total: [],              // 総個体数
        normal: [],             // 正常個体数
        beautiful: [],          // 美しき者
        aggressive: [],         // 攻撃的個体
        birthRates: []          // 出生率
    }
};

// アニメーションID
let animationId = null;
let lastUpdateTime = 0;

// Chart.jsのグラフオブジェクト
let populationChart = null;
let birthRateChart = null;


// ===================================
// 初期化処理
// ===================================

// ページ読み込み時に実行
window.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    initializeEventListeners();
    updateUI();
    drawEnvironment();
});


// ===================================
// グラフ初期化
// ===================================

function initializeCharts() {
    // 個体数推移グラフ
    const popCtx = document.getElementById('populationChart').getContext('2d');
    populationChart = new Chart(popCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '総個体数',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '正常個体',
                    data: [],
                    borderColor: '#4CAF50',
                    tension: 0.4
                },
                {
                    label: '美しき者',
                    data: [],
                    borderColor: '#2196F3',
                    tension: 0.4
                },
                {
                    label: '攻撃的個体',
                    data: [],
                    borderColor: '#F44336',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '個体数'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '経過日数'
                    }
                }
            }
        }
    });

    // 出生率推移グラフ
    const birthCtx = document.getElementById('birthRateChart').getContext('2d');
    birthRateChart = new Chart(birthCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '出生率（%）',
                    data: [],
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: '出生率（%）'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '経過日数'
                    }
                }
            }
        }
    });
}


// ===================================
// イベントリスナー設定
// ===================================

function initializeEventListeners() {
    // 開始ボタン
    document.getElementById('startBtn').addEventListener('click', startSimulation);

    // 停止ボタン
    document.getElementById('pauseBtn').addEventListener('click', pauseSimulation);

    // リセットボタン
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);

    // 速度スライダー
    document.getElementById('speedSlider').addEventListener('input', function(e) {
        simulation.speed = parseFloat(e.target.value);
        document.getElementById('speedValue').textContent = simulation.speed.toFixed(1) + 'x';
    });
}


// ===================================
// シミュレーション制御
// ===================================

// 開始
function startSimulation() {
    if (!simulation.running) {
        simulation.running = true;
        lastUpdateTime = Date.now();

        // ボタンの状態を変更
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;

        // アニメーションループを開始
        runSimulationLoop();
    }
}

// 停止
function pauseSimulation() {
    simulation.running = false;

    // ボタンの状態を変更
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;

    // アニメーションをキャンセル
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

// リセット
function resetSimulation() {
    // 実行中なら停止
    if (simulation.running) {
        pauseSimulation();
    }

    // 状態を初期化
    simulation.day = 0;
    simulation.population = {
        normal: 8,
        beautiful: 0,
        aggressive: 0
    };
    simulation.currentDensity = 0;
    simulation.socialStress = 0;
    simulation.birthRate = 1.0;
    simulation.dailyBirths = 0;

    // 履歴をクリア
    simulation.history = {
        days: [],
        total: [],
        normal: [],
        beautiful: [],
        aggressive: [],
        birthRates: []
    };

    // グラフをクリア
    populationChart.data.labels = [];
    populationChart.data.datasets.forEach(dataset => {
        dataset.data = [];
    });
    populationChart.update();

    birthRateChart.data.labels = [];
    birthRateChart.data.datasets[0].data = [];
    birthRateChart.update();

    // UIを更新
    updateUI();
    drawEnvironment();
}


// ===================================
// シミュレーションループ
// ===================================

function runSimulationLoop() {
    if (!simulation.running) return;

    const currentTime = Date.now();
    const deltaTime = currentTime - lastUpdateTime;

    // 速度に応じて更新（デフォルトは0.1秒 = 100ms）
    const updateInterval = 100 / simulation.speed;

    if (deltaTime >= updateInterval) {
        updateSimulation();
        lastUpdateTime = currentTime;
    }

    animationId = requestAnimationFrame(runSimulationLoop);
}


// ===================================
// シミュレーション更新（1日分）
// ===================================

function updateSimulation() {
    simulation.day++;

    // 総個体数を計算
    const totalPop = getTotalPopulation();

    // 全個体が死滅したら停止
    if (totalPop === 0) {
        pauseSimulation();
        alert('全個体が絶滅しました。実験終了です。');
        return;
    }

    // 密度とストレスを計算
    simulation.currentDensity = totalPop / simulation.maxCapacity;
    simulation.socialStress = Math.pow(simulation.currentDensity, 2);

    // フェーズを判定し、出生率を更新
    updatePhase();

    // 出生処理
    calculateBirths();

    // 死亡処理
    calculateDeaths();

    // 行動変化処理
    updateBehaviors();

    // 履歴を記録（10日ごと）
    if (simulation.day % 10 === 0) {
        recordHistory();
    }

    // UIを更新
    updateUI();
    drawEnvironment();
}


// ===================================
// フェーズ判定と出生率調整
// ===================================

function updatePhase() {
    let phaseName = '';
    let phaseClass = '';
    let description = '';

    if (simulation.day <= 104) {
        // Phase A: 適応期
        phaseName = 'Phase A: 適応期';
        phaseClass = 'phase-a';
        description = '環境に適応し、順調に繁殖が始まります。';
        // Phase Aは適応期なので、出生率は控えめに（徐々に上昇）
        simulation.birthRate = 0.6 + (simulation.day / 104) * 0.4; // 0.6から1.0に徐々に上昇

    } else if (simulation.day <= 315) {
        // Phase B: 成長期
        phaseName = 'Phase B: 成長期';
        phaseClass = 'phase-b';
        description = '豊富な資源により、個体数が急増しています。社会階層が形成されています。';
        // Phase Bで最も高い出生率（ピーク成長期）
        simulation.birthRate = 1.2;

    } else if (simulation.day <= 560) {
        // Phase C: 停滞期
        phaseName = 'Phase C: 停滞期';
        phaseClass = 'phase-c';
        description = '過密により社会行動が崩壊し始めています。攻撃性が高まり、異常行動が増えています。';
        // 密度が上がるほど出生率が激減
        simulation.birthRate = 0.4 * Math.pow(1 - simulation.socialStress, 2);

    } else {
        // Phase D: 死滅期
        phaseName = 'Phase D: 死滅期';
        phaseClass = 'phase-d';
        description = '出生率が極端に低下しています。楽園にもかかわらず、なぜでしょうか？';
        // Phase Dでは出生率が劇的に低下（ストレスが高いとほぼ0%に）
        // 正常個体の割合も考慮（正常個体が少ないと繁殖できない）
        const normalRatio = simulation.population.normal / Math.max(1, getTotalPopulation());
        simulation.birthRate = 0.01 * Math.pow(1 - simulation.socialStress, 3) * Math.pow(normalRatio, 2);
    }

    // フェーズ表示を更新
    const phaseIndicator = document.getElementById('phaseIndicator');
    phaseIndicator.textContent = phaseName;
    phaseIndicator.className = 'phase-indicator ' + phaseClass;

    document.getElementById('phaseDescription').textContent = description;
}


// ===================================
// 出生計算
// ===================================

function calculateBirths() {
    const totalPop = getTotalPopulation();

    // 最大収容数に達していたら出生なし
    if (totalPop >= simulation.maxCapacity) {
        simulation.dailyBirths = 0;
        return;
    }

    // 基本出生率: 正常個体の5%が1日で繁殖可能（現実的な値に調整）
    const baseBirthRate = 0.05;

    // 実効出生率 = 基本出生率 × フェーズ補正 × (1 - ストレス)
    const effectiveBirthRate = baseBirthRate * simulation.birthRate * (1 - simulation.socialStress);

    // 出生数を計算（正常個体のみが繁殖）
    const births = Math.floor(simulation.population.normal * effectiveBirthRate);
    simulation.dailyBirths = births;

    // 出生個体を振り分け
    for (let i = 0; i < births; i++) {
        const rand = Math.random();

        // 密度が高いほど異常個体が生まれやすい
        // Phase Dでは異常個体の出生率がさらに高まる
        let beautifulThreshold = 0.3;
        let aggressiveThreshold = 0.15;

        if (simulation.day > 560) {
            // Phase D: ほぼ全てが異常個体として誕生（正常個体は5%のみ）
            beautifulThreshold = 0.75;
            aggressiveThreshold = 0.2;
        } else if (simulation.day > 315) {
            // Phase C: やや異常個体が増える
            beautifulThreshold = 0.5;
            aggressiveThreshold = 0.25;
        }

        if (simulation.currentDensity > 0.6 && rand < beautifulThreshold) {
            // 美しき者が生まれる
            simulation.population.beautiful++;

        } else if (simulation.currentDensity > 0.5 && rand < beautifulThreshold + aggressiveThreshold) {
            // 攻撃的個体が生まれる
            simulation.population.aggressive++;

        } else {
            // 正常個体が生まれる
            simulation.population.normal++;
        }
    }
}


// ===================================
// 死亡計算
// ===================================

function calculateDeaths() {
    // ストレスによる死亡率増加
    let stressMultiplier = 1 + simulation.socialStress * 5;

    // Phase Dでは死亡率がさらに増加
    if (simulation.day > 560) {
        // Phase Dでは死亡率を大幅に上げて個体数を減少させる
        stressMultiplier = 1 + simulation.socialStress * 15;
    } else if (simulation.day > 315) {
        stressMultiplier = 1 + simulation.socialStress * 8;
    }

    const stressDeathRate = simulation.deathRate * stressMultiplier;

    // 正常個体の死亡
    const normalDeaths = Math.floor(simulation.population.normal * stressDeathRate);
    simulation.population.normal = Math.max(0, simulation.population.normal - normalDeaths);

    // 美しき者の死亡（繁殖しないため、高い死亡率）
    // Phase Dでは自己ケアのみで生存能力が低下し、徐々に死滅
    const beautifulMultiplier = simulation.day > 560 ? 2.5 : 1.2;
    const beautifulDeaths = Math.floor(simulation.population.beautiful * stressDeathRate * beautifulMultiplier);
    simulation.population.beautiful = Math.max(0, simulation.population.beautiful - beautifulDeaths);

    // 攻撃的個体の死亡（争いで死ぬこともある）
    const aggressiveMultiplier = simulation.day > 560 ? 3.0 : 1.5;
    const aggressiveDeaths = Math.floor(simulation.population.aggressive * stressDeathRate * aggressiveMultiplier);
    simulation.population.aggressive = Math.max(0, simulation.population.aggressive - aggressiveDeaths);
}


// ===================================
// 行動変化（正常→異常）
// ===================================

function updateBehaviors() {
    // 密度が40%を超えると、正常個体が異常化し始める
    if (simulation.currentDensity > 0.4) {
        // Phase Dでは転換率が劇的に増加
        let baseConversionRate = 0.005 * simulation.socialStress;

        if (simulation.day > 560) {
            // Phase Dでは正常個体のほぼ全てが「美しき者」や攻撃的個体に変化
            // カルフーンの実験では、最終的に正常個体がほぼ全滅
            baseConversionRate = 0.08 * Math.pow(simulation.socialStress, 0.5);
        } else if (simulation.day > 315) {
            // Phase Cでも転換率を上げる
            baseConversionRate = 0.025 * simulation.socialStress;
        }

        const conversions = Math.floor(simulation.population.normal * baseConversionRate);

        for (let i = 0; i < conversions; i++) {
            if (simulation.population.normal > 0) {
                simulation.population.normal--;

                // Phase Dでは「美しき者」の出現率が非常に高い（90%）
                const beautifulProbability = simulation.day > 560 ? 0.9 : 0.7;

                if (Math.random() < beautifulProbability) {
                    simulation.population.beautiful++;
                } else {
                    simulation.population.aggressive++;
                }
            }
        }
    }
}


// ===================================
// 総個体数取得
// ===================================

function getTotalPopulation() {
    return simulation.population.normal +
           simulation.population.beautiful +
           simulation.population.aggressive;
}


// ===================================
// 履歴記録（グラフ用）
// ===================================

function recordHistory() {
    const totalPop = getTotalPopulation();

    simulation.history.days.push(simulation.day);
    simulation.history.total.push(totalPop);
    simulation.history.normal.push(simulation.population.normal);
    simulation.history.beautiful.push(simulation.population.beautiful);
    simulation.history.aggressive.push(simulation.population.aggressive);
    simulation.history.birthRates.push(Math.round(simulation.birthRate * 100));

    // グラフを更新
    updateCharts();
}


// ===================================
// グラフ更新
// ===================================

function updateCharts() {
    // 個体数グラフ
    populationChart.data.labels = simulation.history.days;
    populationChart.data.datasets[0].data = simulation.history.total;
    populationChart.data.datasets[1].data = simulation.history.normal;
    populationChart.data.datasets[2].data = simulation.history.beautiful;
    populationChart.data.datasets[3].data = simulation.history.aggressive;
    populationChart.update('none'); // アニメーションなしで更新

    // 出生率グラフ
    birthRateChart.data.labels = simulation.history.days;
    birthRateChart.data.datasets[0].data = simulation.history.birthRates;
    birthRateChart.update('none');
}


// ===================================
// UI更新
// ===================================

function updateUI() {
    const totalPop = getTotalPopulation();

    document.getElementById('dayCount').textContent = simulation.day;
    document.getElementById('totalPopulation').textContent = totalPop;
    document.getElementById('normalPopulation').textContent = simulation.population.normal;
    document.getElementById('beautifulPopulation').textContent = simulation.population.beautiful;
    document.getElementById('aggressivePopulation').textContent = simulation.population.aggressive;
    document.getElementById('birthRate').textContent = Math.round(simulation.birthRate * 100) + '%';
    document.getElementById('density').textContent = (simulation.currentDensity * 100).toFixed(1) + '%';
    document.getElementById('dailyBirths').textContent = simulation.dailyBirths;
}


// ===================================
// 環境描画（キャンバス）
// ===================================

function drawEnvironment() {
    const canvas = document.getElementById('environmentCanvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 背景をクリア
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 枠を描画
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // マウスを描画
    const totalPop = getTotalPopulation();
    const displayCount = Math.min(totalPop, 800); // 最大800匹まで表示

    // 各個体タイプの比率を計算
    const normalRatio = simulation.population.normal / totalPop;
    const beautifulRatio = simulation.population.beautiful / totalPop;

    for (let i = 0; i < displayCount; i++) {
        // ランダムな位置
        const x = Math.random() * (width - 40) + 20;
        const y = Math.random() * (height - 40) + 20;
        const size = 3;

        // 個体タイプに応じて色を決定
        const ratio = i / displayCount;

        if (ratio < normalRatio) {
            ctx.fillStyle = '#4CAF50'; // 正常個体（緑）
        } else if (ratio < normalRatio + beautifulRatio) {
            ctx.fillStyle = '#2196F3'; // 美しき者（青）
        } else {
            ctx.fillStyle = '#F44336'; // 攻撃的個体（赤）
        }

        // ドットを描画
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // 情報テキストを表示
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`密度: ${(simulation.currentDensity * 100).toFixed(1)}%`, 20, 35);
    ctx.fillText(`ストレス: ${(simulation.socialStress * 100).toFixed(1)}%`, 20, 55);
}
