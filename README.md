# O Meu Cancioneiro — PWA

Cancioneiro persoal instalable no iPhone e usable no Mac. A aplicación garda cancións e repertorios en IndexedDB no dispositivo; non inclúe contas, servidor de datos, autenticación, sincronización en nube nin chamadas de rede para cancións.

## Desenvolvemento e comprobacións

Requisitos: Node.js 22.12 ou posterior e npm.

```sh
npm ci
npm test
npm run dev
```

Compilación estática:

```sh
npm run build
npm run preview
```

Os ficheiros listos para publicar quedan en `dist/`. A aplicación precisa servirse desde HTTPS para instalarse no iPhone e activar o Service Worker; non precisa API nin base de datos de servidor. A primeira carga require conexión. Despois, a shell da PWA queda dispoñible sen conexión.

## Publicación en GitHub Pages

O workflow de `.github/workflows/pages.yml` constrúe e publica `dist` ao facer push á rama `main`. Crea un repositorio chamado `o-meu-cancioneiro`, sobe este proxecto á rama `main` e activa **Settings → Pages → GitHub Actions**. As rutas relativas permiten servilo baixo o enderezo `https://<usuario>.github.io/o-meu-cancioneiro/`.

A páxina e o código serán públicos. As cancións e repertorios permanecen na base local de cada navegador: non se envían a GitHub nin se sincronizan automaticamente.

## Instalar

1. Publica `dist/` nun aloxamento estático HTTPS.
2. No iPhone, abre o enderezo en Safari, toca **Compartir → Engadir á pantalla de inicio** e abre a icona creada.
3. No Mac, abre o mesmo enderezo no navegador. As bases de cada dispositivo son independentes.

## Transferir datos

En **Axustes e copias**, descarga o JSON completo no primeiro dispositivo e pásao mediante Arquivos, AirDrop ou o medio que prefiras. No segundo dispositivo, escolle o ficheiro e revisa a vista previa. Podes fusionar, manter a versión local en conflitos ou substituír a base despois de descargar unha copia previa.

As copias inclúen cancións, acordes estruturados, repertorios, orde, tonalidades por repertorio e preferencias. Os ficheiros JSON conteñen letras e notas en texto lexible; gárdaos nun lugar privado.

## Funcións implementadas

- Biblioteca local con creación, edición, busca por título, artista, etiquetas, acordes e letra, favoritas, duplicado e eliminación confirmada.
- Editor ChordPro con barra de acordes, inserción na posición do cursor, detección, favoritos, recentes e busca.
- Importación por lotes de `.pro`, `.chopro`, `.cho` e `.crd`; revisión previa, validación polo contido, BOM/finais de liña e UTF-8/UTF-16/Windows-1252.
- Exportación ChordPro por canción, conservando seccións, acordes e directivas descoñecidas.
- Repertorios ordenables e tonalidade por canción; modo de actuación.
- Vista de interpretación con transposición temporal, tamaño de texto, desprazamento e impresión/Save as PDF do navegador.
- Metrónomo Web Audio con 40–240 BPM, compases 2/4, 3/4, 4/4 e 6/8, e varios sons.
- Copias JSON versionadas, validación, fusión e restauración con salvagarda previa.

## Limitacións de PWA

- A persistencia do navegador pódese revogar por limpeza de datos ou presión de almacenamento. Mantén copias exportadas fóra da aplicación.
- O metrónomo está pensado para funcionar en primeiro plano. Safari pode suspender audio ou o bloqueo da pantalla ao pasar a segundo plano; a aplicación tenta retomar o contexto de audio e solicitar Screen Wake Lock cando está dispoñible.
- A impresión/Save as PDF depende das opcións do navegador. Non xera un PDF paginado cun motor nativo.
- Instalar non require unha conta de Apple Developer nin Xcode.

## Arquitectura

- `src/domain`: documento musical, parser/exportador ChordPro, transposición e validación de copias.
- `src/db.ts`: esquema IndexedDB Dexie e solicitude de almacenamento persistente.
- `src/services/backup.ts`: exportación, fusión e restauración local.
- `src/ui`: biblioteca, editor, repertorios, interpretación, metrónomo e axustes.
- `vite.config.ts`: manifest, actualización e precarga offline da PWA.
