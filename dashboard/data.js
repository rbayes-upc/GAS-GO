/* Fixtures independientes de la app y del surtidor. Ninguna fila representa telemetría real. */
window.GGDashboardData={
 snapshot:'2026-11-09T13:42:00+01:00',
 stations:[
  {id:'diagonal',name:'Diagonal',code:'BCN · 01',address:'Av. Diagonal, 670',city:'Barcelona · Les Corts',revenue:5428.6,previousRevenue:5026,operations:117,previousOperations:108,liters:2760,kwh:86.4,capacityKW:300,actualKW:66,uptime:99.9,weekly:[.76,.81,.86,.94,1.02],tanks:[{fuel:'Gasolina 95',liters:14820,capacity:30000,consumption:1910},{fuel:'Diésel',liters:21300,capacity:40000,consumption:2430}]},
  {id:'meridiana',name:'Meridiana',code:'BCN · 02',address:'Av. Meridiana, 276',city:'Barcelona · Sant Andreu',revenue:3819.8,previousRevenue:3650,operations:91,previousOperations:88,liters:2100,kwh:56.2,capacityKW:220,actualKW:96,uptime:98.6,weekly:[.7,.82,.79,.9,1.04],tanks:[{fuel:'Gasolina 95',liters:10440,capacity:30000,consumption:1320},{fuel:'Diésel',liters:4800,capacity:40000,consumption:2260}]},
  {id:'aeroport',name:'Aeroport',code:'BCN · 03',address:'Ctra. de l’Aeroport, 14',city:'El Prat de Llobregat',revenue:3238,previousRevenue:2860,operations:78,previousOperations:70,liters:1740,kwh:48.8,capacityKW:200,actualKW:45,uptime:99.8,weekly:[.8,.85,.83,.96,1.08],tanks:[{fuel:'Gasolina 95',liters:18900,capacity:30000,consumption:1650},{fuel:'Diésel',liters:25300,capacity:40000,consumption:2100}]}
 ],
 equipment:[
  {station:'diagonal',id:'S01',kind:'fuel',state:'active',product:'Gasolina 95',quantity:15.3,amount:24.48,progress:58,operation:'GG-1048'},
  {station:'diagonal',id:'S02',kind:'fuel',state:'free',product:'Diésel'},
  {station:'diagonal',id:'S03',kind:'fuel',state:'free',product:'Gasolina 95 / Diésel'},
  {station:'diagonal',id:'S04',kind:'fuel',state:'verifying',product:'Diésel',operation:'GG-1051'},
  {station:'diagonal',id:'E01',kind:'ev',state:'active',product:'CCS2 · 150 kW',quantity:18.4,amount:7.36,progress:71,power:66,operation:'GG-1042'},
  {station:'diagonal',id:'E02',kind:'ev',state:'free',product:'CCS2 · 150 kW'},
  {station:'meridiana',id:'S01',kind:'fuel',state:'active',product:'Diésel',quantity:32.5,amount:49.4,progress:82,operation:'GG-1047'},
  {station:'meridiana',id:'S02',kind:'fuel',state:'free',product:'Gasolina 95'},
  {station:'meridiana',id:'S03',kind:'fuel',state:'fault',product:'Diésel',alert:'INC-001'},
  {station:'meridiana',id:'S04',kind:'fuel',state:'free',product:'Gasolina 95 / Diésel'},
  {station:'meridiana',id:'E01',kind:'ev',state:'free',product:'CCS2 · 110 kW'},
  {station:'meridiana',id:'E02',kind:'ev',state:'active',product:'CCS2 · 110 kW',quantity:23.8,amount:9.52,progress:63,power:96,operation:'GG-1039'},
  {station:'aeroport',id:'S01',kind:'fuel',state:'free',product:'Gasolina 95'},
  {station:'aeroport',id:'S02',kind:'fuel',state:'verifying',product:'Gasolina 95',operation:'GG-1050'},
  {station:'aeroport',id:'S03',kind:'fuel',state:'free',product:'Diésel'},
  {station:'aeroport',id:'S04',kind:'fuel',state:'active',product:'Diésel',quantity:21.2,amount:33.07,progress:46,operation:'GG-1049'},
  {station:'aeroport',id:'E01',kind:'ev',state:'active',product:'CCS2 · 100 kW',quantity:12.6,amount:5.04,progress:52,power:45,operation:'GG-1040'},
  {station:'aeroport',id:'E02',kind:'ev',state:'free',product:'CCS2 · 100 kW'}
 ],
 alerts:[
  {id:'INC-001',station:'meridiana',severity:'critical',title:'Surtidor 03 fuera de servicio',subtitle:'Error de comunicación con el equipo',time:'13:28',equipment:'S03',description:'El equipo no ha enviado una lectura válida en la simulación. El resto de surtidores de la estación continúa disponible.',action:'Verificar la conexión y solicitar una revisión del equipo antes de volver a habilitarlo.'},
  {id:'INC-002',station:'meridiana',severity:'warning',title:'Reserva de diésel al 12 %',subtitle:'Conviene planificar una reposición',time:'12:56',equipment:'Depósito de diésel',description:'La lectura de demostración es de 4.800 L sobre una capacidad de 40.000 L. Con el consumo medio de muestra quedan aproximadamente 2,1 días de autonomía.',action:'Revisar la previsión de consumo y coordinar la próxima entrega con el proveedor.'},
  {id:'INC-003',station:'aeroport',severity:'info',title:'Revisión preventiva esta semana',subtitle:'Punto de carga E02 · mantenimiento',time:'11:40',equipment:'E02',description:'La revisión periódica del cargador está prevista para el jueves 12 de noviembre. El punto está disponible en esta demostración.',action:'Confirmar una franja de intervención que minimice el impacto en la estación.'}
 ],
 operations:[
  {id:'GG-1051',station:'diagonal',equipment:'S04',time:'13:42',plate:'•••• MTR',product:'Diésel',quantity:0,amount:0,status:'verifying',method:'Automática'},
  {id:'GG-1050',station:'aeroport',equipment:'S02',time:'13:41',plate:'•••• BCD',product:'Gasolina 95',quantity:0,amount:0,status:'verifying',method:'Automática'},
  {id:'GG-1049',station:'aeroport',equipment:'S04',time:'13:40',plate:'•••• KLP',product:'Diésel',quantity:21.2,amount:33.07,status:'active',method:'Automática'},
  {id:'GG-1048',station:'diagonal',equipment:'S01',time:'13:39',plate:'•••• GHT',product:'Gasolina 95',quantity:15.3,amount:24.48,status:'active',method:'Automática'},
  {id:'GG-1047',station:'meridiana',equipment:'S01',time:'13:38',plate:'•••• FGH',product:'Diésel',quantity:32.5,amount:49.4,status:'active',method:'Automática'},
  {id:'GG-1046',station:'diagonal',equipment:'S02',time:'13:36',plate:'•••• JKL',product:'Diésel',quantity:28.46,amount:44.11,status:'completed',method:'Automática'},
  {id:'GG-1045',station:'meridiana',equipment:'S04',time:'13:34',plate:'•••• MNP',product:'Gasolina 95',quantity:22.16,amount:35.01,status:'completed',method:'Código C'},
  {id:'GG-1044',station:'aeroport',equipment:'S03',time:'13:31',plate:'•••• PQR',product:'Diésel',quantity:42.9,amount:66.92,status:'completed',method:'Automática'},
  {id:'GG-1043',station:'diagonal',equipment:'S03',time:'13:28',plate:'•••• STV',product:'Gasolina 95',quantity:19.8,amount:31.68,status:'completed',method:'Confirmación B'},
  {id:'GG-1042',station:'diagonal',equipment:'E01',time:'13:25',plate:'•••• EVG',product:'Electricidad',quantity:18.4,amount:7.36,status:'active',method:'Automática'},
  {id:'GG-1041',station:'meridiana',equipment:'S02',time:'13:22',plate:'•••• XYZ',product:'Gasolina 95',quantity:30.1,amount:47.56,status:'completed',method:'Automática'},
  {id:'GG-1040',station:'aeroport',equipment:'E01',time:'13:20',plate:'•••• EVH',product:'Electricidad',quantity:12.6,amount:5.04,status:'active',method:'Automática'},
  {id:'GG-1039',station:'meridiana',equipment:'E02',time:'13:18',plate:'•••• EVJ',product:'Electricidad',quantity:23.8,amount:9.52,status:'active',method:'Automática'},
  {id:'GG-1038',station:'diagonal',equipment:'S01',time:'13:15',plate:'•••• BCF',product:'Gasolina 95',quantity:35.2,amount:56.32,status:'completed',method:'Automática'},
  {id:'GG-1037',station:'aeroport',equipment:'S01',time:'13:12',plate:'•••• GHL',product:'Gasolina 95',quantity:17.5,amount:28,status:'completed',method:'Automática'},
  {id:'GG-1036',station:'meridiana',equipment:'S03',time:'13:10',plate:'•••• JKM',product:'Diésel',quantity:12.2,amount:18.54,status:'interrupted',method:'Automática'},
  {id:'GG-1035',station:'diagonal',equipment:'E02',time:'13:04',plate:'•••• EVK',product:'Electricidad',quantity:34.2,amount:13.68,status:'completed',method:'Automática'},
  {id:'GG-1034',station:'aeroport',equipment:'S02',time:'13:01',plate:'•••• MNT',product:'Gasolina 95',quantity:24.3,amount:38.88,status:'completed',method:'Automática'}
 ]
};
