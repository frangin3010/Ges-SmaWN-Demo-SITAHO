document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION (Basée sur ton fichier) ---
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycbwRndRiOeVtW9K6ix97qKXmYL3FurYAmfD8Fd2mZZ8Lv2zrJqWMlhKbBbymwXNrcf6ZlQ/exec';
    
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

            const cumulativeData1 = rawData.filter(d => d.gesBoxId === 'GesBox1');
            const cumulativeData2 = rawData.filter(d => d.gesBoxId === 'GesBox2');

            // On utilise la nouvelle fonction d'alignement plus robuste
            const synchronizedData = alignData(cumulativeData1, cumulativeData2);

            displayDataInTable(synchronizedData);
            updateChart(synchronizedData);

            const options = { dateStyle: 'long', timeStyle: 'medium' };
            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleString('fr-FR', options)}`;

        } catch (error) {
            console.error('Erreur lors de la mise à jour ou de l\'affichage:', error);
            statusText.textContent = 'Erreur lors de la mise à jour des données. Vérifiez la console pour plus de détails.';
        }
    }

    // --- MODIFICATION : Remplacement de l'ancienne fonction alignData ---
    function alignData(data1, data2) {
        if (data1.length === 0 && data2.length === 0) return [];

        let result = [];
        let index1 = 0;
        let index2 = 0;
        let lastVolume1 = null;
        let lastVolume2 = null;

        // On continue tant qu'on a des données à traiter dans l'une des deux listes
        while (index1 < data1.length || index2 < data2.length) {
            const point1 = index1 < data1.length ? data1[index1] : null;
            const point2 = index2 < data2.length ? data2[index2] : null;

            // Cas 1 : Les deux listes ont encore des points
            if (point1 && point2) {
                if (point1.timestamp <= point2.timestamp) {
                    lastVolume1 = point1.volume;
                    result.push({ timestamp: point1.timestamp, volume1: lastVolume1, volume2: lastVolume2 });
                    index1++;
                } else {
                    lastVolume2 = point2.volume;
                    result.push({ timestamp: point2.timestamp, volume1: lastVolume1, volume2: lastVolume2 });
                    index2++;
                }
            } 
            // Cas 2 : Il ne reste que des points dans data1
            else if (point1) {
                lastVolume1 = point1.volume;
                result.push({ timestamp: point1.timestamp, volume1: lastVolume1, volume2: lastVolume2 });
                index1++;
            }
            // Cas 3 : Il ne reste que des points dans data2
            else if (point2) {
                lastVolume2 = point2.volume;
                result.push({ timestamp: point2.timestamp, volume1: lastVolume1, volume2: lastVolume2 });
                index2++;
            }
        }
        return result;
    }

    // Fonction pour afficher les données dans le tableau
    function displayDataInTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            statusText.textContent = 'Aucune donnée synchronisée à afficher.';
            return;
        }

        // Affiche les données en ordre inverse (plus récentes en haut) pour le tableau
        const reversedData = [...data].reverse();

        reversedData.forEach(item => {
            const row = document.createElement('tr');

            const v1 = item.volume1 !== null ? item.volume1 : 0;
            const v2 = item.volume2 !== null ? item.volume2 : 0;

            const diffVolume = (item.volume1 !== null && item.volume2 !== null) ? (v1 - v2).toFixed(3) : 'N/A';
            const diffPercent = (v1 > 0 && item.volume2 !== null) ? (((v1 - v2) / v1) * 100).toFixed(2) + '%' : 'N/A';
            
            const date = new Date(item.timestamp * 1000);
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' };
            const formattedTime = date.toLocaleString('fr-FR', options);
            
            row.innerHTML = `
                <td>${formattedTime} (UTC)</td>
                <td>${item.volume1 !== null ? item.volume1.toFixed(3) : '---'}</td>
                <td>${item.volume2 !== null ? item.volume2.toFixed(3) : '---'}</td>
                <td>${diffVolume}</td>
                <td>${diffPercent}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Fonction pour gérer le graphique
    function updateChart(data) {
        if (!chartCanvas) return;

        const labels = data.map(item => new Date(item.timestamp * 1000).toLocaleTimeString('fr-FR', {timeZone: 'UTC'}));
        const gesbox1Data = data.map(item => item.volume1);
        const gesbox2Data = data.map(item => item.volume2); // On peut passer null, Chart.js le gère

        const chartData = {
            labels: labels,
            datasets: [{
                label: 'Volume Cumulé GesBox 1 (L)',
                data: gesbox1Data,
                borderColor: 'rgb(54, 162, 235)', // Bleu
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                spanGaps: true, // Relie les points s'il y a des données manquantes (null)
                tension: 0.1
            }, {
                label: 'Volume Cumulé GesBox 2 (L)',
                data: gesbox2Data,
                borderColor: 'rgb(255, 99, 132)', // Rouge
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                spanGaps: true, // Relie les points s'il y a des données manquantes (null)
                tension: 0.1
            }]
        };

        if (!volumeChart) {
            const config = {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    animation: false, // Désactive l'animation pour des mises à jour plus fluides
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
