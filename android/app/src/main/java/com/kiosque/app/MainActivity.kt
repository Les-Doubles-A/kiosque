package com.kiosque.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.kiosque.app.ui.KiosqueApp
import com.kiosque.app.ui.KiosqueTheme
import com.kiosque.app.ui.KiosqueViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val vm: KiosqueViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Actualisation auto tant que l'app est visible (aucun travail en arriere-plan).
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    vm.refreshIfStale()
                    delay(30_000)
                }
            }
        }
        setContent { KiosqueTheme { KiosqueApp(vm) } }
    }
}
