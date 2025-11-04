document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION ---
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycbwRndRiOeVtW9K6ix97qKXmYL3FurYAmfD8Fd2mZZ8Lv2zrJqWMlhKbBbymwXNrcf6ZlQ/exec';
    
    // Marge de tolérance en pourcentage pour l'alerte
    const alertThresholdPercent = 8.0; 

    // Intervalle de temps pour la synchronisation du TABLEAU et du GRAPHIQUE
    const tableSyncToleranceSeconds = 16; 

    // --- ÉLÉMENTS DE LA PAGE ---
    const tableBody = document.getElementById('dataTableBody');
    const statusText = document.getElementById('status');
    const chartCanvas = document.getElementById('volumeChart');
    const summaryTitle = document.getElementById('summary-title');
    const summaryVolume1 = document.getElementById('summary-volume1');
    const summaryVolume2 = document.getElementById('summary-volume2');
    const alertContainer = document.getElementById('alert-container');

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

            const dataGesbox1 = rawData.filter(d => d.gesBoxId === 'GesBox1');
            const dataGesbox2 = rawData.filter(d => d.gesBoxId === 'GesBox2');

            // --- SIMPLIFICATION MAJEURE ---
            // On utilise UN SEUL jeu de données synchronisées pour le tableau ET le graphique
            const synchronizedData = alignDataForTable(dataGesbox1, dataGesbox2);

            // On envoie ces mêmes données aux deux fonctions d'affichage
            displayDataInTable(synchronizedData);
            updateChart(synchronizedData); 
            
            // La synthèse utilise toujours les données brutes pour avoir la dernière valeur de chaque capteur
            updateSummaryAndAlerts(dataGesbox1, dataGesbox2);

            const options = { dateStyle: 'long', timeStyle: 'medium' };
            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleString('fr-FR', options)}`;

        } catch (error) {
            console.error('Erreur lors de la mise à jour ou de l\'affichage:', error);
            statusText.textContent = 'Erreur lors de la mise à jour des données.';
        }
    }
    
    // --- L'UNIQUE ALGORITHME D'ALIGNEMENT (pour le tableau ET le graphique) ---
    function alignDataForTable(data1, data2) {
        const aligned = [];

        // On prend data1 (GesBox 1) comme référence
        data1.forEach(point1 => {
            let bestMatch = null;
            let smallestDifference = Infinity;

            // On cherche la correspondance la plus proche dans data2
            data2.forEach(point2 => {
                const timeDiff = Math.abs(point1.timestamp - point2.timestamp);

                // Si la différence est dans la tolérance ET qu'elle est la plus petite trouvée jusqu'ici
                if (timeDiff <= tableSyncToleranceSeconds && timeDiff < smallestDifference) {
                    smallestDifference = timeDiff;
                    bestMatch = point2;
                }
            });

            // On crée la ligne du tableau
            aligned.push({
                timestamp: point1.timestamp,
                volume1: point1.volume,
                volume2: bestMatch ? bestMatch.volume : null // On utilise la correspondance ou null
            });
        });

        return aligned;
    }

    // --- LES AUTRES FONCTIONS RESTENT LES MÊMES ---
    
    function updateSummaryAndAlerts(data1, data2) {
        const lastDataPoint1 = data1.length > 0 ? data1[data1.length - 1] : null;
        const lastDataPoint2 = data2.length > 0 ? data2[data2.length - 1] : null;

        const lastVolume1 = lastDataPoint1 ? lastDataPoint1.volume : null;
        const lastVolume2 = lastDataPoint2 ? lastDataPoint2.volume : null;
        
        const lastTimestamp1 = lastDataPoint1 ? lastDataPoint1.timestamp : 0;
        const lastTimestamp2 = lastDataPoint2 ? lastDataPoint2.timestamp : 0;
        const mostRecentTimestamp = Math.max(lastTimestamp1, lastTimestamp2);

        if (mostRecentTimestamp > 0) {
            const lastDate = new Date(mostRecentTimestamp * 1000);
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' };
            summaryTitle.textContent = `Synthèse à ${lastDate.toLocaleString('fr-FR', options)} (UTC)`;
        }

        summaryVolume1.textContent = lastVolume1 !== null ? `${lastVolume1.toFixed(3)} L` : '--.-- L';
        summaryVolume2.textContent = lastVolume2 !== null ? `${lastVolume2.toFixed(3)} L` : '--.-- L';
        
        if (lastVolume1 !== null && lastVolume2 !== null) {
            const difference = Math.abs(lastVolume1 - lastVolume2);
            const maxVolume = Math.max(lastVolume1, lastVolume2);
            if (maxVolume > 0) {
                const diffPercent = (difference / maxVolume) * 100;
                if (diffPercent > alertThresholdPercent) {
                    alertContainer.classList.add('alert-visible');
                } else {
                    alertContainer.classList.remove('alert-visible');
                }
            }
        } else {
            alertContainer.classList.remove('alert-visible');
        }
    }

    function displayDataInTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) { statusText.textContent = 'Aucune donnée de la GesBox 1 à afficher.'; return; }
        const reversedData = [...data].reverse(); 
        reversedData.forEach(item => {
            const row = document.createElement('tr');
            const v1 = item.volume1;
            const v2 = item.volume2;
            const diffVolume = (v1 !== null && v2 !== null) ? (v1 - v2).toFixed(3) : 'N/A';
            const diffPercent = (v1 > 0 && v2 !== null) ? (((v1 - v2) / v1) * 100).toFixed(2) + '%' : 'N/A';
            const date = new Date(item.timestamp * 1000);
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' };
            const formattedTime = date.toLocaleString('fr-FR', options);
            row.innerHTML = `<td>${formattedTime} (UTC)</td><td>${v1.toFixed(3)}</td><td>${v2 !== null ? v2.toFixed(3) : '---'}</td><td>${diffVolume}</td><td>${diffPercent}</td>`;
            tableBody.appendChild(row);
        });
    }

    function updateChart(data) {
        if (!chartCanvas) return;
        // L'axe X du graphique sera basé sur les timestamps de la GesBox 1 (notre référence)
        const labels = data.map(item => new Date(item.timestamp * 1000).toLocaleTimeString('fr-FR', {timeZone: 'UTC'}));
        const gesbox1Data = data.map(item => item.volume1);
        const gesbox2Data = data.map(item => item.volume2); // Cette liste contiendra des 'null' là où il n'y a pas de correspondance

        const chartData = {
            labels: labels,
            datasets: [
                { 
                    label: 'Volume Cumulé GesBox 1 (L)', 
                    data: gesbox1Data, 
                    borderColor: 'rgb(54, 162, 235)', 
                    backgroundColor: 'rgba(54, 162, 235, 0.5)', 
                    tension: 0.1 
                }, 
                { 
                    label: 'Volume Cumulé GesBox 2 (L)', 
                    data: gesbox2Data, 
                    borderColor: 'rgb(255, 99, 132)', 
                    backgroundColor: 'rgba(255, 99, 132, 0.5)', 
                    spanGaps: true, // Cette option relie les points par-dessus les "trous" (valeurs null)
                    tension: 0.1 
                }
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

    // --- EXÉCUTION ---
    fetchDataAndDisplay();
    setInterval(fetchDataAndDisplay, 30000); 
});
