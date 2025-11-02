document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATION ---
    // Remplacez par l'URL de votre script Google Apps (la même que dans le code ESP32)
    const googleScriptURL = 'https://script.google.com/macros/s/AKfycbz5nODXrc7NftBi9tJn20nygxf3hzOa6zBE_0uYL32luHCIeLzRT4f8rCUwb3Si2k9sMA/exec';
    
    // Intervalle de tolérance en secondes pour synchroniser les données
    const toleranceSeconds = 10;

    // Éléments de la page
    const tableBody = document.getElementById('dataTableBody');
    const statusText = document.getElementById('status');

    // --- FONCTIONS ---

    // Fonction principale pour récupérer et traiter les données
    async function fetchDataAndDisplay() {
        statusText.textContent = 'Mise à jour des données depuis Google Sheets...';
        try {
            // 1. Récupérer les données brutes depuis Google Sheets
            const response = await fetch(googleScriptURL);
            if (!response.ok) {
                throw new Error('Erreur réseau lors de la récupération des données.');
            }
            const rawData = await response.json();

            // 2. Séparer les données par GesBox
            const dataGesbox1 = rawData.filter(d => d.gesBoxId === 'GesBox1').sort((a, b) => a.timestamp - b.timestamp);
            const dataGesbox2 = rawData.filter(d => d.gesBoxId === 'GesBox2').sort((a, b) => a.timestamp - b.timestamp);

            // 3. Aligner les données
            const synchronizedData = alignData(dataGesbox1, dataGesbox2);

            // 4. Afficher les données dans le tableau
            displayDataInTable(synchronizedData);

            statusText.textContent = `Dernière mise à jour : ${new Date().toLocaleTimeString()}`;

        } catch (error) {
            console.error('Erreur lors de la récupération ou du traitement des données:', error);
            statusText.textContent = 'Erreur lors de la mise à jour des données. Vérifiez la console.';
        }
    }

    // Algorithme d'alignement des données
    function alignData(data1, data2) {
        const aligned = [];
        let index2 = 0; // Pointeur pour data2

        data1.forEach(point1 => {
            let foundMatch = false;
            // On cherche un point dans data2 qui est "proche" dans le temps
            while (index2 < data2.length) {
                const point2 = data2[index2];
                const timeDiff = point2.timestamp - point1.timestamp;

                // Si point2 est dans notre fenêtre de tolérance
                if (timeDiff >= 0 && timeDiff <= toleranceSeconds) {
                    aligned.push({
                        timestamp: point1.timestamp,
                        volume1: point1.volume,
                        volume2: point2.volume
                    });
                    foundMatch = true;
                    // On ne casse pas la boucle pour potentiellement trouver une correspondance plus proche, mais on avance le pointeur
                    // Pour simplifier, on prend la première correspondance et on continue
                    break; 
                }

                // Si point2 est trop "loin dans le futur", on arrête de chercher pour ce point1
                if (timeDiff > toleranceSeconds) {
                    break;
                }

                // Si point2 est dans le passé, on avance le pointeur de data2
                index2++;
            }
            
            // Si aucune correspondance n'a été trouvée pour point1
            if (!foundMatch) {
                 aligned.push({
                    timestamp: point1.timestamp,
                    volume1: point1.volume,
                    volume2: null // Pas de donnée pour GesBox 2 à ce moment
                });
            }
        });

        return aligned;
    }

    // Fonction pour afficher les données dans le tableau HTML
    function displayDataInTable(data) {
        // Vide le tableau existant
        tableBody.innerHTML = '';

        if (data.length === 0) {
            statusText.textContent = 'Aucune donnée synchronisée à afficher.';
            return;
        }

        data.forEach(item => {
            const row = document.createElement('tr');

            const diffVolume = item.volume2 !== null ? (item.volume1 - item.volume2).toFixed(3) : 'N/A';
            const diffPercent = (item.volume1 > 0 && item.volume2 !== null) ? (((item.volume1 - item.volume2) / item.volume1) * 100).toFixed(2) + '%' : 'N/A';
            
            // Convertit le timestamp en une date lisible
            const date = new Date(item.timestamp * 1000);
            const formattedTime = date.toLocaleTimeString('fr-FR');


            row.innerHTML = `
                <td>${formattedTime}</td>
                <td>${item.volume1.toFixed(3)}</td>
                <td>${item.volume2 !== null ? item.volume2.toFixed(3) : '---'}</td>
                <td>${diffVolume}</td>
                <td>${diffPercent}</td>
            `;

            tableBody.appendChild(row);
        });
    }

    // --- EXÉCUTION ---
    
    // Charge les données au démarrage de la page
    fetchDataAndDisplay();

    // Met à jour les données toutes les 30 secondes
    setInterval(fetchDataAndDisplay, 30000); 


});
