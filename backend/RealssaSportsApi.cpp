#include <iostream>
#include <string>
#include <vector>
#include <thread>
#include <chrono>
#include <mutex>
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>
#include <httplib.h>

using json = nlohmann::json;

// Global storage so the server can access what the loop fetches
std::string latest_match_data = "{\"status\": \"initializing\"}";
std::mutex data_mutex;

// SportMonks API Token - Free tier
const std::string SPORTMONKS_API_TOKEN = "ALtscQqBIKoL0vsLPO8ELYiQ19V90d6phTZbFBeWO6r7Uqk1Q86Op4lCOo8D";
const std::string SPORTMONKS_BASE_URL = "https://api.sportmonks.com/v3/football";

struct Match {
    int id;
    std::string homeTeam, awayTeam, league;
    int homeScore, awayScore;
    int minute;
    std::string status; // LIVE, FT, HT, scheduled
    std::string country;
    std::string homeLogo, awayLogo, leagueLogo;
};

void sendNotification(const Match& m) {
    std::cout << ">>> NOTIFICATION: ";
    if (m.status == "LIVE") {
        std::cout << "⚽ LIVE GOAL in " << m.league << "! ";
    } else {
        std::cout << "Match update in " << m.league << "! ";
    }
    std::cout << m.homeTeam << " " << m.homeScore << " - "
        << m.awayScore << " " << m.awayTeam << std::endl;
}

// Helper to extract current score from SportMonks scores array
int getScoreByType(const json& scores, int typeId, const std::string& participant) {
    for (const auto& score : scores) {
        if (score.contains("type_id") && score["type_id"] == typeId) {
            if (score.contains("score") && score["score"].contains("goals")) {
                return score["score"]["goals"].get<int>();
            }
        }
    }
    return 0;
}

void processLiveMatches() {
    while (true) {
        std::cout << "\n--- Realssa Engine: Fetching from SportMonks ---" << std::endl;
        
        // Try to get live scores first
        cpr::Response r = cpr::Get(
            cpr::Url{ SPORTMONKS_BASE_URL + "/livescores/inplay" },
            cpr::Header{ 
                {"Authorization", "Bearer " + SPORTMONKS_API_TOKEN},
                {"Accept", "application/json"}
            },
            cpr::Parameters{
                {"include", "participants;scores;periods;events;league.country;round"}
            }
        );

        json response;
        bool hasLiveMatches = false;

        if (r.status_code == 200) {
            try {
                auto data = json::parse(r.text);
                
                // Build matches array from SportMonks format
                json matchesArray = json::array();
                
                // Check if we have live matches in the response
                if (data.contains("data") && data["data"].is_array()) {
                    auto& matches = data["data"];
                    hasLiveMatches = !matches.empty();
                    
                    for (const auto& match : matches) {
                        Match m;
                        m.id = match["id"];
                        m.status = "LIVE";
                        m.minute = 0;
                        
                        // League info
                        if (match.contains("league") && !match["league"].is_null()) {
                            m.league = match["league"]["name"];
                        }
                        
                        // Participants (teams)
                        if (match.contains("participants") && match["participants"].is_array()) {
                            for (const auto& p : match["participants"]) {
                                if (p.contains("meta") && p["meta"].contains("location")) {
                                    if (p["meta"]["location"] == "home") {
                                        m.homeTeam = p["name"];
                                        if (p.contains("image_path")) {
                                            m.homeLogo = p["image_path"];
                                        }
                                    } else if (p["meta"]["location"] == "away") {
                                        m.awayTeam = p["name"];
                                        if (p.contains("image_path")) {
                                            m.awayLogo = p["image_path"];
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Get scores
                        if (match.contains("scores") && match["scores"].is_array()) {
                            // Get current score (type_id 1525 = CURRENT)
                            m.homeScore = getScoreByType(match["scores"], 1525, "home");
                            m.awayScore = getScoreByType(match["scores"], 1525, "away");
                        }
                        
                        // Get minute from periods
                        if (match.contains("periods") && match["periods"].is_array()) {
                            for (const auto& p : match["periods"]) {
                                if (p.contains("name")) {
                                    if (p["name"] == "FIRSTHALF") m.minute = 45;
                                    else if (p["name"] == "SECONDHALF") m.minute = 90;
                                    else if (p["name"] == "EXTRATIME_FIRST") m.minute = 105;
                                    else if (p["name"] == "EXTRATIME_SECOND") m.minute = 120;
                                    else if (p["name"] == "PENALTY") m.minute = 120;
                                }
                            }
                        }
                        
                        // Country
                        if (match.contains("league") && match["league"].contains("country")) {
                            m.country = match["league"]["country"]["name"];
                        }
                        
                        matchesArray.push_back({
                            {"id", m.id},
                            {"homeTeam", m.homeTeam},
                            {"awayTeam", m.awayTeam},
                            {"homeScore", m.homeScore},
                            {"awayScore", m.awayScore},
                            {"minute", m.minute},
                            {"status", m.status},
                            {"league", m.league},
                            {"country", m.country},
                            {"homeLogo", m.homeLogo},
                            {"awayLogo", m.awayLogo}
                        });
                        
                        std::cout << "[LIVE] " << m.homeTeam << " " << m.homeScore 
                            << " - " << m.awayScore << " " << m.awayTeam 
                            << " (" << m.minute << "')" << std::endl;
                    }
                }
                
                // If no live matches, try today's scheduled matches
                if (!hasLiveMatches) {
                    std::cout << "No live matches. Fetching today's scheduled games..." << std::endl;
                    
                    cpr::Response schedR = cpr::Get(
                        cpr::Url{ SPORTMONKS_BASE_URL + "/schedules" },
                        cpr::Header{ 
                            {"Authorization", "Bearer " + SPORTMONKS_API_TOKEN},
                            {"Accept", "application/json"}
                        },
                        cpr::Parameters{
                            {"include", "participants;league;scores;round"}
                        }
                    );
                    
                    if (schedR.status_code == 200) {
                        try {
                            auto schedData = json::parse(schedR.text);
                            if (schedData.contains("data") && schedData["data"].is_array()) {
                                for (const auto& match : schedData["data"]) {
                                    Match m;
                                    m.id = match["id"];
                                    m.status = "SCHEDULED";
                                    m.minute = 0;
                                    
                                    // League
                                    if (match.contains("league") && !match["league"].is_null()) {
                                        m.league = match["league"]["name"];
                                    }
                                    
                                    // Teams
                                    if (match.contains("participants") && match["participants"].is_array()) {
                                        for (const auto& p : match["participants"]) {
                                            if (p.contains("meta") && p["meta"].contains("location")) {
                                                if (p["meta"]["location"] == "home") {
                                                    m.homeTeam = p["name"];
                                                } else if (p["meta"]["location"] == "away") {
                                                    m.awayTeam = p["name"];
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Scores
                                    if (match.contains("scores") && match["scores"].is_array()) {
                                        m.homeScore = getScoreByType(match["scores"], 1525, "home");
                                        m.awayScore = getScoreByType(match["scores"], 1525, "away");
                                        
                                        // Check if match has started (FT = finished)
                                        for (const auto& s : match["scores"]) {
                                            if (s.contains("type_id") && s["type_id"] == 48996) { // 2ND_HALF_ONLY
                                                m.status = "FT";
                                            }
                                        }
                                    }
                                    
                                    // Starting time
                                    std::string startTime = "";
                                    if (match.contains("starting_at")) {
                                        startTime = match["starting_at"];
                                    }
                                    
                                    matchesArray.push_back({
                                        {"id", m.id},
                                        {"homeTeam", m.homeTeam},
                                        {"awayTeam", m.awayTeam},
                                        {"homeScore", m.homeScore},
                                        {"awayScore", m.awayScore},
                                        {"minute", m.minute},
                                        {"status", m.status},
                                        {"league", m.league},
                                        {"country", ""},
                                        {"startingAt", startTime}
                                    });
                                    
                                    if (m.status == "FT") {
                                        std::cout << "[FT] " << m.homeTeam << " " << m.homeScore 
                                            << " - " << m.awayScore << " " << m.awayTeam << std::endl;
                                    }
                                }
                            }
                        } catch (const std::exception& e) {
                            std::cout << "Error parsing scheduled matches: " << e.what() << std::endl;
                        }
                    }
                }
                
                // Create response JSON
                json finalResponse = {
                    {"status", "success"},
                    {"source", "SportMonks API"},
                    {"response", matchesArray},
                    {"timestamp", std::time(nullptr)},
                    {"server", "Realssa C++ Engine"},
                    {"liveCount", matchesArray.size()}
                };
                
                // Update global string for web server
                {
                    std::lock_guard<std::mutex> lock(data_mutex);
                    latest_match_data = finalResponse.dump();
                }
                
                std::cout << "Total matches loaded: " << matchesArray.size() << std::endl;
                
            } catch (const std::exception& e) {
                std::cout << "Error parsing response: " << e.what() << std::endl;
                json errorResponse = {
                    {"status", "error"},
                    {"message", e.what()},
                    {"server", "Realssa C++ Engine"}
                };
                std::lock_guard<std::mutex> lock(data_mutex);
                latest_match_data = errorResponse.dump();
            }
        } else {
            std::cout << "API Error: " << r.status_code << std::endl;
            if (r.status_code == 403 || r.status_code == 401) {
                std::cout << "API token issue - check SportMonks subscription" << std::endl;
            }
            json errorResponse = {
                {"status", "error"},
                {"code", r.status_code},
                {"message", "Failed to fetch from SportMonks"},
                {"server", "Realssa C++ Engine"}
            };
            std::lock_guard<std::mutex> lock(data_mutex);
            latest_match_data = errorResponse.dump();
        }
        
        std::cout << "Waiting 2 minutes for next update..." << std::endl;
        std::this_thread::sleep_for(std::chrono::minutes(2));
    }
}

int main() {
    std::cout << "=========================================" << std::endl;
    std::cout << "    Realssa Sports API - SportMonks Edition" << std::endl;
    std::cout << "=========================================" << std::endl;
    
    // Start the background fetch loop
    std::thread worker(processLiveMatches);
    worker.detach();

    // Setup HTTP server
    httplib::Server svr;

    svr.Get("/scores", [](const httplib::Request&, httplib::Response& res) {
        std::lock_guard<std::mutex> lock(data_mutex);
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Content-Type", "application/json");
        res.set_content(latest_match_data, "application/json");
    });

    svr.Get("/health", [](const httplib::Request&, httplib::Response& res) {
        json health = {
            {"status", "healthy"},
            {"server", "Realssa C++ Engine"},
            {"source", "SportMonks API"}
        };
        res.set_content(health.dump(), "application/json");
    });

    svr.Get("/", [](const httplib::Request&, httplib::Response& res) {
        res.set_content(R"({
            "service": "Realssa Sports API",
            "version": "2.0",
            "provider": "SportMonks",
            "endpoints": {
                "/scores": "Get all match scores",
                "/health": "Health check"
            }
        })", "application/json");
    });

    std::cout << "Realssa API starting on port 8080..." << std::endl;
    std::cout << "Endpoint: http://localhost:8080/scores" << std::endl;
    std::cout << "=========================================" << std::endl;
    
    svr.listen("0.0.0.0", 8080);

    return 0;
}
