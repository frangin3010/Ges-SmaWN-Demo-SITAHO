document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION (Basée sur ton fichier) ---
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycbwFgBY3Xwc19JqN3kcGyTXjkO3-LeSnG50b5eTXAUidLPTarRuqGM0JRs2QuwNffU-tkA/exec';
    const toleranceSeconds = 10;

    // --- ÉLÉMENTS DE LA PAGE ---
    const tableBody = document.getElementById('dataTableBody');
    const statusText = document.getElementById('status');
    // AJOUT : On récupère le canevas du graphique
    const chartCanvas = document.getElementById('volumeChart');

    // --- VARIABLE GLOBALE POUR LE GRAPHIQUE ---
    // AJOUT : On va stocker notre graphique ici pour pouvoir le mettre à jour
    let volumeChart; 

    // --- FONCTIONS ---

    async function fetchDataAndDisplay() {
        statusText.textContent = 'Mise à jour des données depuis Google Sheets...';
        try {
            const response = await fetch(googleScriptURL);
            if (!response.ok) throw new Error('Erreur réseau.');
            const rawData = await response.json();
            
            // S'assurer que les données sont triées par timestamp
            rawData.sort((a, b) => a.timestamp - b.timestamp);

            const dataGesbox1 = rawData.filter(d => d.gesBoxId === 'GesBox1');
            const dataGesbox2 = rawData.filter(d => d.gesBoxId === 'GesBox2');

            // AJOUT : Calculer le volume cumulé pour un affichage correct sur le graphique
            const cumulativeData1 = calculateCumulativeVolume(dataGesbox1);
            const cumulativeData2 = calculateCumulativeVolume(dataGesbox2);

            const synchronizedData = alignData(cumulativeData1, cumulativeData2);

            displayDataInTable(synchronizedData);
            
            // AJOUT : Dessiner ou mettre à jour le graphique avec les données
            updateChart(synchronizedData);

            const options = { dateStyle: 'long', timeStyle: 'medium' };
            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleString('fr-FR', options)}`;

        } catch (error) {
            console.error('Erreur:', error);
            statusText.textContent = 'Erreur lors de la mise à jour des données.';
        }
    }

    // AJOUT : Nouvelle fonction pour calculer le volume cumulé
    function calculateCumulativeVolume(data) {
        let cumulativeVolume = 0;
        return data.map(point => {
            cumulativeVolume += point.volume;
            return {
                ...point, // Copie les propriétés existantes (gesBoxId, timestamp)
                volume: cumulativeVolume // Remplace le volume par le volume cumulé
            };
        });
    }
    
    // Ta fonction alignData est conservée telle quelle
    function alignData(data1, data2) {
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

    // Ta fonction displayDataInTable est conservée, j'ai juste ajusté le titre des colonnes pour correspondre au HTML
    function displayDataInTable(data) {
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

    // AJOUT : Nouvelle fonction pour gérer le graphique
    function updateChart(data) {
        if (!chartCanvas) return;

        const labels = data.map(item => new Date(item.timestamp * 1000).toLocaleTimeString('fr-FR', {timeZone: 'UTC'}));
        const gesbox1Data = data.map(item => item.volume1);
        const gesbox2Data = data.map(item => item.volume2 !== null ? item.volume2 : NaN);

        const chartData = {
            labels: labels,
            datasets: [{
                label: 'Volume Cumulé GesBox 1 (L)',
                data: gesbox1Data,
                borderColor: 'rgb(54, 162, 235)', // Bleu
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                tension: 0.1
            }, {
                label: 'Volume Cumulé GesBox 2 (L)',
                data: gesbox2Data,
                borderColor: 'rgb(255, 99, 132)', // Rouge
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                tension: 0.1
            }]
        };

        if (!volumeChart) {
            const config = {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Suivi des Volumes Cumulés' } },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Volume (L)' } },
                        x: { title: { display: true, text: 'Heure (UTC)' } }
                    }
                }
            };
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
