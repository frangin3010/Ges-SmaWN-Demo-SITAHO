document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION ---
    // IMPORTANT : Pense à mettre ici le NOUVEAU lien que tu obtiendras après avoir redéployé le script Google Apps
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycby64me45DPUwJuafXVc6eLDYLBqc27wkOFWk17h7aX2JuAA-yQPQ5mmYbe_MKrwsDo0Yg/exec';
    
    // --- ÉLÉMENTS DE LA PAGE ---
    const tableBody = document.getElementById('dataTableBody');
    const statusText = document.getElementById('status');
    const chartCanvas = document.getElementById('volumeChart');
    const collapsibleHeader = document.querySelector('.collapsible-header');
    const collapsibleContent = document.querySelector('.collapsible-content');

    let volumeChart; 

    collapsibleHeader.addEventListener('click', () => {
        collapsibleHeader.classList.toggle('active');
        if (collapsibleContent.style.maxHeight) {
            collapsibleContent.style.maxHeight = null;
        } else {
            collapsibleContent.style.maxHeight = collapsibleContent.scrollHeight + "px";
        }
    });

    async function fetchDataAndDisplay() {
        statusText.textContent = 'Mise à jour des données depuis Google Sheets...';
        try {
            const response = await fetch(googleScriptURL);
            if (!response.ok) throw new Error('Erreur réseau.');
            const rawData = await response.json();
            
            // On trie toutes les données brutes par timestamp une seule fois
            rawData.sort((a, b) => a.timestamp - b.timestamp);

            const dataGesbox1 = rawData.filter(d => d.gesBoxId === 'GesBox1');
            const dataGesbox2 = rawData.filter(d => d.gesBoxId === 'GesBox2');

            // On utilise la nouvelle fonction d'alignement plus robuste
            const synchronizedData = alignData(dataGesbox1, dataGesbox2);

            displayDataInTable(synchronizedData);
            updateChart(synchronizedData);

            const options = { dateStyle: 'long', timeStyle: 'medium' };
            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleString('fr-FR', options)}`;

        } catch (error) {
            console.error('Erreur lors de la mise à jour:', error);
            statusText.textContent = 'Erreur lors de la mise à jour des données.';
        }
    }

    // --- NOUVELLE FONCTION D'ALIGNEMENT PLUS ROBUSTE ---
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

            // On choisit le point le plus ancien dans le temps
            if (point1 && (!point2 || point1.timestamp <= point2.timestamp)) {
                lastVolume1 = point1.volume_cumule; // Met à jour la dernière valeur connue de la GesBox 1
                result.push({
                    timestamp: point1.timestamp,
                    volume1: lastVolume1,
                    volume2: lastVolume2 // Utilise la dernière valeur connue de la GesBox 2
                });
                index1++;
            } else if (point2) {
                lastVolume2 = point2.volume_cumule; // Met à jour la dernière valeur connue de la GesBox 2
                result.push({
                    timestamp: point2.timestamp,
                    volume1: lastVolume1, // Utilise la dernière valeur connue de la GesBox 1
                    volume2: lastVolume2
                });
                index2++;
            }
        }
        return result;
    }

    function displayDataInTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            statusText.textContent = 'Aucune donnée synchronisée à afficher.';
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
