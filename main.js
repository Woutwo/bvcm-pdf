const pdfjsLib = window['pdfjs-dist/build/pdf'];
const daysOfWeek = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']

const loadPdf = async (data) => {
    const loadingTask = pdfjsLib.getDocument({data});
    const pdf = await loadingTask.promise

    const textNodes = []
    const annotations = []
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const {items} = await page.getTextContent()
        textNodes.push(...items)
        annotations.push(...await page.getAnnotations())
    }
    return {textNodes, annotations}
}

const extractDayRows = (nodes) => {
    const filteredNodes = nodes.filter(f => f.fontName === "g_d0_f1")
    const days = []
    let day;
    for (let node of filteredNodes) {
        if (daysOfWeek.includes(node.str)) {
            if (day !== undefined) {
                days.push(day)
            }
            day = []
        }
        if (day !== undefined) {
            day.push(node)
        }
    }
    return days
}

const parseDays = (days, annotations) => {
    const planning = []
    for (let day of days) {
        const parts = day[1].str.split('/')
        const date = new Date(parts[2], parts[1]-1, parts[0])

        // Extract activity blocks
        const regEx = /(?<activity>.+?)\s(?<start>.+?)-(?<end>.+)/
        if (regEx.test(day[2].str)) {
            const {groups} = regEx.exec(day[2].str)
            const start = new Date(parts[2], parts[1]-1, parts[0], ...groups.start.split(':').map(s => parseInt(s)))
            const end = new Date(parts[2], parts[1]-1, parts[0], ...groups.end.split(':').map(s => parseInt(s)))

            // Check for annotation
            const annotationRegEx = /javascript:CCPopUp\('wpgPopupInfo', '(.+?)'\);/
            let annotation;
            if (day[9] && day[9].str === 'Ja') {
                const a = annotations.shift()
                if (a.unsafeUrl && annotationRegEx.test(a.unsafeUrl)) {
                    annotation = decodeURIComponent(annotationRegEx.exec(a.unsafeUrl)[1])
                }
            }

            planning.push({start, end, activity: groups.activity, annotation})
        }
    }

    return planning
}

const pad = (time) => time < 10 ? `0${time}` : time

const usToNormalPeopleDay = (day) => day === 0 ? 6 : day - 1

const generateRows = (planning) => {
    const tbody = document.getElementById('tbody')
    tbody.innerHTML = ''

    for (let plan of planning) {
        const elem = document.createElement('tr')
        elem.innerHTML = `<td>${pad(plan.start.getDate())}-${pad(plan.start.getMonth()+1)}-${pad(plan.start.getFullYear())}</td>
<td>${daysOfWeek[usToNormalPeopleDay(plan.start.getDay())]}</td>
<td>${plan.activity}</td>
<td>${pad(plan.start.getHours())}:${pad(plan.start.getMinutes())}</td>
<td>${pad(plan.end.getHours())}:${pad(plan.end.getMinutes())}</td>
<td>${plan.annotation ?? ''}</td>`
        tbody.appendChild(elem)
    }
}

const generateIcs = (planning) => {
    const cal = ics();
    for (let plan of planning) {
        cal.addEvent(plan.activity, plan.annotation || '', '', plan.start, plan.end);
    }
    cal.download('bvcm');
}

const start = async (data) => {
    const {textNodes, annotations} = await loadPdf(data)
    const days = extractDayRows(textNodes)
    const planning = parseDays(days, annotations)
    console.log(planning)
    generateRows(planning)

    const button = document.getElementById('download')
    button.removeAttribute('disabled')
    button.addEventListener('click', () => {
        generateIcs(planning)
    })
}

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM READY')
    document.getElementById('file').addEventListener('change', event => {
        console.log('CHANGE', event)

        const file = event.target.files[0]
        const ext = file.name.split('.')[file.name.split('.').length - 1]
        if (file && ext === 'pdf') {
            const reader = new FileReader();
            reader.onload = async e => {
                console.log(`PDF read ${e.target.result.length} bytes`)
                await start(e.target.result)
            }
            reader.readAsBinaryString(file);
        } else {
            alert('Alleen PDF bestanden toegestaan')
        }
    })
})