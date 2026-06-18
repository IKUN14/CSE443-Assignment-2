import { useMemo } from "react";
import { FlatList, Image, ImageBackground, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDemo } from "../src/context/DemoContext";
import { movies } from "../src/data/movies";
import { ActionButton, Card, ChoiceChip, NotificationBell, Screen, StatCard, TopBar, TopTabs } from "../src/components/DemoUI";
import { formatSessionStatus } from "../src/utils/formatters";

export default function MovieListScreen() {
  const { username, setUsername, unreadCount, sessionStatus } = useDemo();
  const quickUsers = useMemo(() => ["User A", "User B"], []);

  return (
    <Screen>
      <TopBar
        title="TGV Cinemas"
        subtitle="MOVIE BOOKING"
        left={
          <Image
            source={require("../assets/tgv-cinemas-logo.png")}
            style={{
              width: 56,
              height: 34,
              borderRadius: 6,
            }}
            resizeMode="contain"
          />
        }
        right={
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <NotificationBell
              count={unreadCount}
              onPress={() => router.push("/notifications")}
            />
            <Pressable
              onPress={() => router.push("/admin")}
              style={{
                height: 36,
                paddingHorizontal: 12,
                borderRadius: 18,
                backgroundColor: "#1b1b20",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800", fontSize: 12 }}>Admin</Text>
            </Pressable>
          </View>
        }
      />

      <TopTabs
        activeKey="home"
        tabs={[
          { key: "home", label: "Home", onPress: () => {} },
          { key: "my-ticket", label: "My Ticket", onPress: () => router.push("/my-ticket") },
          { key: "wait-list", label: "Wait List", onPress: () => router.push("/wait-list") },
          { key: "notifications", label: "Alerts", onPress: () => router.push("/notifications") },
        ]}
      />

      <Card>
        <View
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#e50914",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="person" size={16} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#8a8a93", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: "800" }}>
                Viewer
              </Text>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "900", marginTop: 2 }}>{username}</Text>
            </View>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,183,3,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,183,3,0.24)",
            }}
          >
            <Text style={{ color: "#ffcf70", fontSize: 11, fontWeight: "800" }}>{formatSessionStatus(sessionStatus)}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {quickUsers.map((user) => (
            <ChoiceChip
              key={user}
              label={user}
              selected={username === user}
              onPress={() => setUsername(user)}
              style={{ flex: 1, alignItems: "center", paddingVertical: 14 }}
            />
          ))}
        </View>
      </Card>

      <Card title="Current session" subtitle="This is the global demo state used by the booking flow.">
        <Text style={{ color: "#d4d4d8" }}>Status: {formatSessionStatus(sessionStatus)}</Text>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <StatCard label="Movies" value="3" helper="Demo lineup" tone="success" />
        <StatCard label="Flows" value="2" helper="Queue + waitlist" tone="accent" />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ color: "#8a8a93", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "800" }}>
          Featured films
        </Text>
        <Text style={{ color: "#e50914", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "800" }}>
          {movies.length} movies
        </Text>
      </View>

      <FlatList
        data={movies}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/showtime/${item.id}`)}
            style={{
              backgroundColor: "#141414",
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#222",
              height: 120,
              flexDirection: "row",
            }}
          >
            <ImageBackground
              source={item.poster}
              style={{
                width: 88,
                backgroundColor: item.heroColor,
                position: "relative",
              }}
              imageStyle={{ opacity: 0.92 }}
            >
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.22)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  backgroundColor: "rgba(0,0,0,0.72)",
                }}
              >
                <Text style={{ color: "white", fontSize: 9, fontWeight: "900" }}>{item.rating}</Text>
              </View>
            </ImageBackground>

            <View style={{ flex: 1, padding: 12, justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: "white", fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: "#e50914", fontSize: 11, fontWeight: "800", marginTop: 4 }}>
                  {item.genre}
                </Text>
                <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="time-outline" size={12} color="#777" />
                    <Text style={{ color: "#777", fontSize: 11 }}>{item.duration}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="star" size={12} color="#777" />
                    <Text style={{ color: "#777", fontSize: 11 }}>{item.rating}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#e50914", fontSize: 12, fontWeight: "900" }}>Book Now</Text>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "#e50914",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="chevron-forward" size={14} color="white" />
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
