; Detecta exclusivamente el ejecutable de la aplicacion. No usa PowerShell,
; perfiles del usuario ni coincidencias por carpeta o por prefijo de nombre.
!macro customCheckAppRunning
  ruleta_check_running:
    ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 603
      Goto ruleta_check_finished
    ${ElseIf} $R0 == 0
      ${If} ${Silent}
        ${nsProcess::Unload}
        SetErrorLevel 2
        Quit
      ${EndIf}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "La aplicacion Ruleta Perks y Killers esta abierta. Cierra su ventana y sus vistas previas, y pulsa Reintentar. El instalador no cerrara otros programas." /SD IDCANCEL IDRETRY ruleta_check_running
    ${Else}
      ${If} ${Silent}
        ${nsProcess::Unload}
        SetErrorLevel 2
        Quit
      ${EndIf}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "No se pudo comprobar si la ruleta esta abierta (codigo $R0). Pulsa Reintentar para volver a comprobar o Cancelar para salir. Tus ajustes se conservaran." /SD IDCANCEL IDRETRY ruleta_check_running
    ${EndIf}
    ${nsProcess::Unload}
    SetErrorLevel 2
    Quit
  ruleta_check_finished:
    ${nsProcess::Unload}
!macroend
