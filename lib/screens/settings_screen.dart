import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../providers/transcription_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _apiKeyController = TextEditingController();
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  bool _hasApiKey = false;

  @override
  void initState() {
    super.initState();
    _loadApiKey();
  }

  Future<void> _loadApiKey() async {
    final hasKey = await _apiService.hasApiKey();
    setState(() {
      _hasApiKey = hasKey;
      _isLoading = false;
    });

    if (hasKey) {
      final apiKey = await _apiService.getApiKey();
      // Only show first few characters for security
      if (apiKey != null && apiKey.isNotEmpty) {
        _apiKeyController.text =
            '${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}';
      }
    }
  }

  @override
  void dispose() {
    _apiKeyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body:
          _isLoading
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'OpenAI API Key',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Your API key is stored securely on your device and is only used to access the OpenAI transcription API.',
                    ),
                    const SizedBox(height: 16),
                    if (_hasApiKey) ...[
                      TextField(
                        controller: _apiKeyController,
                        decoration: const InputDecoration(
                          labelText: 'Current API Key (masked)',
                          border: OutlineInputBorder(),
                          enabled: false,
                        ),
                        readOnly: true,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          ElevatedButton(
                            onPressed: _updateApiKey,
                            child: const Text('Update API Key'),
                          ),
                          ElevatedButton(
                            onPressed: _removeApiKey,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Remove API Key'),
                          ),
                        ],
                      ),
                    ] else ...[
                      TextField(
                        controller: _apiKeyController,
                        decoration: const InputDecoration(
                          labelText: 'Enter your OpenAI API Key',
                          hintText: 'sk-...',
                          border: OutlineInputBorder(),
                        ),
                        obscureText: true,
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _saveApiKey,
                          child: const Text('Save API Key'),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Don\'t have an API key? You can get one from the OpenAI website.',
                        style: TextStyle(fontStyle: FontStyle.italic),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () {
                          // In a real app, you might open a browser to the OpenAI API key page
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Visit: https://platform.openai.com/api-keys',
                              ),
                            ),
                          );
                        },
                        child: const Text('Get an API Key'),
                      ),
                    ],
                  ],
                ),
              ),
    );
  }

  Future<void> _saveApiKey() async {
    final apiKey = _apiKeyController.text.trim();
    if (apiKey.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please enter an API key')));
      return;
    }

    await _apiService.saveApiKey(apiKey);
    setState(() {
      _hasApiKey = true;
    });

    // Notify the provider that API key has been updated
    if (mounted) {
      Provider.of<TranscriptionProvider>(context, listen: false).refreshApiKeyStatus();
    }

    if (!mounted) return;

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('API key saved')));

    // Reload to mask the key
    _loadApiKey();
  }

  Future<void> _updateApiKey() async {
    setState(() {
      _hasApiKey = false;
      _apiKeyController.clear();
    });
  }

  Future<void> _removeApiKey() async {
    showDialog(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Remove API Key?'),
            content: const Text(
              'This will remove your OpenAI API key from this device. You will need to enter it again to use the transcription feature.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () async {
                  Navigator.pop(dialogContext);
                  await _apiService.deleteApiKey();

                  // Notify the provider that API key has been removed
                  if (mounted) {
                    Provider.of<TranscriptionProvider>(context, listen: false).refreshApiKeyStatus();
                  }

                  if (!mounted) return;

                  setState(() {
                    _hasApiKey = false;
                    _apiKeyController.clear();
                  });

                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('API key removed')),
                  );
                },
                child: const Text('Remove'),
              ),
            ],
          ),
    );
  }
}
