document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION (Basée sur ton fichier) ---
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycbyc-T8xUKDFvKw121YJOLGWMgxg985eqx9KPmSzC4dqe9qI47Nxnqx3vFvYV4QjGTtQTg/exec';
    const toleranceSeconds = 10;

    // --- ÉLÉMENTS DE LA PAGE ---
    const tableBody = document.getElementById('dataTableBody');
    const statusText = document.getElementById('status');
    const chartCanvas = document.getElementById('volumeChart');

    // --- VARIABLE GLOBALE POUR LE GRAPHIQUE ---
    let volumeChart; 

    // --- FONCTIONS ---

    async function fetchDataAndDisplay() {
        statusText.textContent = 'Mise à jour des données depuis Google Sheets...';
        try {
            const response = await fetch(googleScriptURL);
            if (!response.ok) throw new Error('Erreur réseau.');
            const rawData = await response.json();
            
            rawData.sort((a, b) => a.timestamp - b.timestamp);

            // Les données reçues sont DÉJÀ cumulées, on les utilise directement
            const cumulativeData1 = rawData.filter(d => d.gesBoxId === 'GesBox1');
            const cumulativeData2 = rawData.filter(d => d.gesBoxId === 'GesBox2');

            // On aligne les données cumulées
            const synchronizedData = alignData(cumulativeData1, cumulativeData2);

            displayDataInTable(synchronizedData);
            updateChart(synchronizedData);

            const options = { dateStyle: 'long', timeStyle: 'medium' };
            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleString('fr-FR', options)}`;

        } catch (error) {
            console.error('Erreur:', error);
            statusText.textContent = 'Erreur lors de la mise à jour des données.';
        }
    }

    // --- SUPPRESSION ---
    // La fonction calculateCumulativeVolume est supprimée car elle est la cause du problème ici.
    // L'ESP32 est maintenant la source unique de vérité pour le cumul.

    // Ta fonction alignData est conservée telle quelle
    function alignData(data1, data2) {
        // ... (Pas de changement dans cette fonction, elle reste identique)
        const aligned = [];
        let index2 = 0;
        data1.forEach(point1 => {
            let foundMatch = false;
            while (index2 < data2.length) {
                const point2 = data2[index2];
                const timeDiff = point2.timestamp - point1.timestamp;
                if (timeDiff >= 0 && timeDiff <= toleranceSeconds) {
                    aligned.push({ timestamp: point1.timestamp, volume1: point1.volume, volume2: point2.volume });
                    foundMatch = true;
                    break;
                }
                if (timeDiff > toleranceSeconds) break;
                index2++;
            }
            if (!foundMatch) {
                 aligned.push({ timestamp: point1.timestamp, volume1: point1.volume, volume2: null });
            }
        });
        return aligned;
    }

    // Ta fonction displayDataInTable est conservée
    function displayDataInTable(data) {
        // ... (Pas de changement dans cette fonction, elle reste identique)
        tableBody.innerHTML = '';
        if (data.length === 0) {
            statusText.textContent = 'Aucune donnée synchronisée à afficher.';
            return;
        }
        data.forEach(item => {
            const row = document.createElement('tr');
            const diffVolume = item.volume2 !== null ? (item.volume1 - item.volume2).toFixed(3) : 'N/A';
            const diffPercent = (item.volume1 > 0 && item.volume2 !== null) ? (((item.volume1 - item.volume2) / item.volume1) * 100).toFixed(2) + '%' : 'N/A';
            const date = new Date(item.timestamp * 1000);
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' };
            const formattedTime = date.toLocaleString('fr-FR', options);
            row.innerHTML = `<td>${formattedTime} (UTC)</td><td>${item.volume1.toFixed(3)}</td><td>${item.volume2 !== null ? item.volume2.toFixed(3) : '---'}</td><td>${diffVolume}</td><td>${diffPercent}</td>`;
            tableBody.appendChild(row);
        });
    }

    // La fonction updateChart est conservée
    function updateChart(data) {
        // ... (Pas de changement dans cette fonction, elle reste identique)
        if (!chartCanvas) return;
        const labels = data.map(item => new Date(item.timestamp * 1000).toLocaleTimeString('fr-FR', {timeZone: 'UTC'}));
        const gesbox1Data = data.map(item => item.volume1);
        const gesbox2Data = data.map(item => item.volume2 !== null ? item.volume2 : NaN);
        const chartData = {
            labels: labels,
            datasets: [{
                label: 'Volume Cumulé GesBox 1 (L)',
                data: gesbox1Data,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                tension: 0.1
            }, {
                label: 'Volume Cumulé GesBox 2 (L)',
                data: gesbox2Data,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                tension: 0.1
            }]
        };
        if (!volumeChart) {
            const config = { type: 'line', data: chartData, options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Suivi des Volumes Cumulés' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Volume (L)' } }, x: { title: { display: true, text: 'Heure (UTC)' } } } } };
            volumeChart = new Chart(chartCanvas, config);
        } else {
            volumeChart.data = chartData;
            volumeChart.update();
        }
    }

    // --- EXÉCUTION ---
    fetchDataAndDisplay();
    setInterval(fetchDataAndDisplay, 30000); 
});
