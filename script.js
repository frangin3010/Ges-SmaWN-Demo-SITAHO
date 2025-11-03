document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION ---
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycby2fDqPNwMZsPyNfj4TjVcMN8j_f-mpYnP2_PNGCVfLFdq7DlZToLPAxZ4sppS6e-GjjQ/exec';
    const toleranceSeconds = 15; // Écart de temps max en secondes pour une correspondance

    // --- ÉLÉMENTS DE LA PAGE ---
    const tableBody = document.getElementById('dataTableBody');
    const statusText = document.getElementById('status');
    const chartCanvas = document.getElementById('volumeChart');
    let volumeChart; 

    async function fetchDataAndDisplay() {
        statusText.textContent = 'Mise à jour des données...';
        try {
            const response = await fetch(googleScriptURL);
            if (!response.ok) throw new Error('Erreur réseau.');
            const rawData = await response.json();
            
            const dataGesbox1 = rawData.filter(d => d.gesBoxId === 'GesBox1').sort((a, b) => a.timestamp - b.timestamp);
            const dataGesbox2 = rawData.filter(d => d.gesBoxId === 'GesBox2').sort((a, b) => a.timestamp - b.timestamp);

            const synchronizedData = alignData(dataGesbox1, dataGesbox2);

            displayDataInTable(synchronizedData);
            updateChart(synchronizedData);

            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleString('fr-FR')}`;

        } catch (error) {
            console.error('Erreur:', error);
            statusText.textContent = 'Erreur lors de la mise à jour.';
        }
    }

    // --- RETOUR À LA LOGIQUE D'ALIGNEMENT INITIALE (SIMPLE ET FIABLE) ---
    // Cette fonction utilise GesBox 1 comme référence et cherche la meilleure
    // correspondance pour GesBox 2 dans une fenêtre de temps.
    function alignData(data1, data2) {
        let alignedData = [];
        let lastFoundIndex2 = 0; // Pour optimiser la recherche

        // On parcourt les données de la GesBox 1 (la référence)
        for (const point1 of data1) {
            let bestMatch = null;
            
            // On cherche la correspondance la plus proche pour ce point1 dans les données de la GesBox 2
            for (let i = lastFoundIndex2; i < data2.length; i++) {
                const point2 = data2[i];
                const timeDiff = Math.abs(point1.timestamp - point2.timestamp);

                // Si on trouve un point dans la fenêtre de tolérance
                if (timeDiff <= toleranceSeconds) {
                    bestMatch = point2;
                    lastFoundIndex2 = i; // On mémorise l'index pour la prochaine recherche
                    break; // On prend la première correspondance trouvée et on arrête de chercher
                }
                
                // Optimisation : si les données de la GesBox 2 sont déjà trop loin dans le futur,
                // inutile de continuer à chercher pour ce point1.
                if (point2.timestamp > point1.timestamp + toleranceSeconds) {
                    break;
                }
            }

            alignedData.push({
                timestamp: point1.timestamp,
                volume1: point1.volume_cumule,
                volume2: bestMatch ? bestMatch.volume_cumule : null // Si pas de correspondance, on met null
            });
        }
        return alignedData;
    }

    function displayDataInTable(data) {
        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            statusText.textContent = 'Aucune donnée à afficher.';
            return;
        }

        const reversedData = [...data].reverse();
        reversedData.forEach(item => {
            const row = document.createElement('tr');
            const v1 = (item.volume1 !== null && isFinite(item.volume1)) ? parseFloat(item.volume1) : null;
            const v2 = (item.volume2 !== null && isFinite(item.volume2)) ? parseFloat(item.volume2) : null;
            const diffVolume = (v1 !== null && v2 !== null) ? (v1 - v2).toFixed(3) : 'N/A';
            const diffPercent = (v1 > 0 && v2 !== null) ? (((v1 - v2) / v1) * 100).toFixed(2) + '%' : 'N/A';
            
            const date = new Date(item.timestamp * 1000);
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' };
            const formattedTime = date.toLocaleString('fr-FR', options);
            
            row.innerHTML = `<td>${formattedTime}</td><td>${v1 !== null ? v1.toFixed(3) : '---'}</td><td>${v2 !== null ? v2.toFixed(3) : '---'}</td><td>${diffVolume}</td><td>${diffPercent}</td>`;
            tableBody.appendChild(row);
        });
    }

    function updateChart(data) {
        if (!chartCanvas) return;
        const labels = data.map(item => new Date(item.timestamp * 1000).toLocaleTimeString('fr-FR', {timeZone: 'UTC'}));
        const gesbox1Data = data.map(item => item.volume1);
        const gesbox2Data = data.map(item => item.volume2);
        const chartData = {
            labels: labels,
            datasets: [
                { label: 'Volume Cumulé GesBox 1 (L)', data: gesbox1Data, borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.5)', spanGaps: true, tension: 0.1 },
                { label: 'Volume Cumulé GesBox 2 (L)', data: gesbox2Data, borderColor: 'rgb(255, 99, 132)', backgroundColor: 'rgba(255, 99, 132, 0.5)', spanGaps: true, tension: 0.1 }
            ]
        };
        if (!volumeChart) {
            const config = { type: 'line', data: chartData, options: { responsive: true, animation: false, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Suivi des Volumes Cumulés' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Volume (L)' } }, x: { title: { display: true, text: 'Heure (UTC)' } } } } };
            volumeChart = new Chart(chartCanvas, config);
        } else {
            volumeChart.data = chartData;
            volumeChart.update();
        }
    }

    fetchDataAndDisplay();
    setInterval(fetchDataAndDisplay, 30000);
});
